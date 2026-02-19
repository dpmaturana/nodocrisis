import type { ClassificationType } from "@/lib/needLevelEngine";

// ── Input types ──────────────────────────────────────────────────────────────

export type TweetAuthorType = "institutional" | "ngo" | "social_news";

export interface Tweet {
  tweet_id: string;
  author_handle: string;
  author_type_estimate: TweetAuthorType;
  created_at: string;
  text: string;
  retweet_count: number;
  reply_count: number;
  /** Optional per-tweet classification provided by an upstream classifier. */
  classification?: {
    type: ClassificationType;
    confidence: number;
  };
}

// ── Output types (strict schema from issue) ──────────────────────────────────

export interface SupportingQuote {
  tweet_id: string;
  author_handle: string;
  created_at: string;
  quote_text: string;
  tweet_confidence: number;
}

export interface AggregatedClassification {
  type: ClassificationType;
  llm_aggregated_confidence: number;
  deterministic_agg_confidence: number;
  support_count: number;
  supporting_quotes: SupportingQuote[];
  augmentation_flag?: boolean;
  notes?: string;
}

export interface KeyEvidence {
  tweet_id: string;
  role: "supporting" | "contradicting";
  quote: string;
}

export interface AggregatedSignal {
  event_id: string;
  window_start: string;
  window_end: string;
  raw_tweet_ids: string[];
  source_reliability_tag: "social_news";
  aggregated_confidence: number;
  classifications: AggregatedClassification[];
  summary: string;
  contradiction_detected: boolean;
  key_evidence: KeyEvidence[];
  method_version: string;
  timestamp: string;
}

// ── Classification patterns ──────────────────────────────────────────────────

const AUGMENTATION_PATTERN =
  /sending reinforcements|dispatching team|we will deploy additional|enviando refuerzos|desplegando equipo/i;

interface ClassificationRule {
  type: ClassificationType;
  pattern: RegExp;
  baseConfidence: number;
}

const CLASSIFICATION_RULES: ClassificationRule[] = [
  {
    type: "SIGNAL_FRAGILITY_ALERT",
    pattern: /fragil|riesgo|colapso|inestable|collapse|at risk|unstable|vulnerable/i,
    baseConfidence: 0.7,
  },
  {
    type: "SIGNAL_INSUFFICIENCY",
    pattern: /no alcanza|insuficiente|saturado|sin\s|not enough|insufficient|overwhelmed|shortage|running out/i,
    baseConfidence: 0.7,
  },
  {
    type: "SIGNAL_STABILIZATION",
    pattern: /operando|estable|normaliz|restablec|stabiliz|restored|under control|improving|recovered/i,
    baseConfidence: 0.6,
  },
  {
    type: "SIGNAL_COVERAGE_ACTIVITY",
    pattern: /llega|despacho|en camino|refuerzo|arrived|dispatched|on.?site|deploy|responding|sending|team/i,
    baseConfidence: 0.6,
  },
  {
    type: "SIGNAL_BOTTLENECK",
    pattern: /bloqueado|cortado|road\s?block|cut\s?off|no access|bottleneck|blocked|impassable/i,
    baseConfidence: 0.65,
  },
  {
    type: "SIGNAL_DEMAND_INCREASE",
    pattern: /necesitamos|urgente|ayuda|help|need|surge|demand|desperate|emergency|critical|sos/i,
    baseConfidence: 0.6,
  },
];

// ── Contradiction pairs ──────────────────────────────────────────────────────

const CONTRADICTION_PAIRS: [RegExp, RegExp][] = [
  [/on.?site|arrived|deployed|teams?\s+(?:are|is)\s+here/i, /no\s+team|nobody\s+(?:arrived|came|here)|no\s+response/i],
  [/stabiliz|under control|improving/i, /worsen|deteriorat|out of control|collaps/i],
  [/sufficient|enough|adequate/i, /insufficient|not enough|shortage|running out/i],
];

// ── Core aggregation ─────────────────────────────────────────────────────────

function classifyTweet(tweet: Tweet): { type: ClassificationType; confidence: number }[] {
  if (tweet.classification) {
    return [tweet.classification];
  }

  const matches: { type: ClassificationType; confidence: number }[] = [];
  for (const rule of CLASSIFICATION_RULES) {
    if (rule.pattern.test(tweet.text)) {
      matches.push({ type: rule.type, confidence: rule.baseConfidence });
    }
  }
  return matches;
}

function extractQuote(text: string, maxLen = 120): string {
  return text.length <= maxLen ? text : text.slice(0, maxLen - 1) + "…";
}

function detectContradictions(
  tweets: Tweet[],
): { detected: boolean; evidence: KeyEvidence[] } {
  const evidence: KeyEvidence[] = [];
  let detected = false;

  for (const [patA, patB] of CONTRADICTION_PAIRS) {
    const sideA = tweets.filter((t) => patA.test(t.text));
    const sideB = tweets.filter((t) => patB.test(t.text));

    if (sideA.length >= 2 && sideB.length >= 2) {
      detected = true;
      for (const t of sideA.slice(0, 2)) {
        evidence.push({ tweet_id: t.tweet_id, role: "supporting", quote: extractQuote(t.text) });
      }
      for (const t of sideB.slice(0, 2)) {
        evidence.push({ tweet_id: t.tweet_id, role: "contradicting", quote: extractQuote(t.text) });
      }
    }
  }

  return { detected, evidence };
}

export function aggregateTweets(
  eventId: string,
  tweets: Tweet[],
  nowIso?: string,
): AggregatedSignal {
  const timestamp = nowIso ?? new Date().toISOString();

  if (tweets.length === 0) {
    return {
      event_id: eventId,
      window_start: timestamp,
      window_end: timestamp,
      raw_tweet_ids: [],
      source_reliability_tag: "social_news",
      aggregated_confidence: 0,
      classifications: [],
      summary: "no relevant tweets in window",
      contradiction_detected: false,
      key_evidence: [],
      method_version: "tweet-agg-v1",
      timestamp,
    };
  }

  // Compute time window
  const sortedDates = tweets
    .map((t) => t.created_at)
    .sort();
  const windowStart = sortedDates[0];
  const windowEnd = sortedDates[sortedDates.length - 1];

  // Group tweets by classification type
  const buckets = new Map<
    ClassificationType,
    { tweet: Tweet; confidence: number }[]
  >();

  for (const tweet of tweets) {
    const labels = classifyTweet(tweet);
    for (const label of labels) {
      if (!buckets.has(label.type)) {
        buckets.set(label.type, []);
      }
      buckets.get(label.type)!.push({ tweet, confidence: label.confidence });
    }
  }

  // Build classifications
  const classifications: AggregatedClassification[] = [];

  for (const [type, entries] of buckets) {
    const supportCount = entries.length;

    // Deterministic aggregate: average of per-tweet confidences
    const hasTweetConfidences = entries.some((e) => e.tweet.classification != null);
    const deterministicAgg = hasTweetConfidences
      ? entries.reduce((sum, e) => sum + e.confidence, 0) / entries.length
      : 0;

    // LLM aggregated confidence – heuristic based on support count and avg confidence
    const avgConf = entries.reduce((sum, e) => sum + e.confidence, 0) / entries.length;
    const countFactor = Math.min(supportCount / 5, 1); // saturates at 5 tweets
    const llmAgg = clamp01(avgConf * (0.5 + 0.5 * countFactor));

    const supportingQuotes: SupportingQuote[] = entries.slice(0, 5).map((e) => ({
      tweet_id: e.tweet.tweet_id,
      author_handle: e.tweet.author_handle,
      created_at: e.tweet.created_at,
      quote_text: extractQuote(e.tweet.text),
      tweet_confidence: clamp01(e.confidence),
    }));

    const classification: AggregatedClassification = {
      type,
      llm_aggregated_confidence: round4(llmAgg),
      deterministic_agg_confidence: round4(deterministicAgg),
      support_count: supportCount,
      supporting_quotes: supportingQuotes,
    };

    // Augmentation flag only for SIGNAL_COVERAGE_ACTIVITY
    if (type === "SIGNAL_COVERAGE_ACTIVITY") {
      const hasExplicitAugmentation = entries.some((e) =>
        AUGMENTATION_PATTERN.test(e.tweet.text),
      );
      classification.augmentation_flag = hasExplicitAugmentation;
    }

    classifications.push(classification);
  }

  // Sort by llm confidence descending
  classifications.sort(
    (a, b) => b.llm_aggregated_confidence - a.llm_aggregated_confidence,
  );

  // Aggregated confidence: max of llm_aggregated_confidence
  const aggregatedConfidence =
    classifications.length > 0
      ? Math.max(...classifications.map((c) => c.llm_aggregated_confidence))
      : 0;

  // Contradiction detection
  const { detected: contradictionDetected, evidence: contradictionEvidence } =
    detectContradictions(tweets);

  // Key evidence: top supporting quotes + contradiction evidence
  const keyEvidence: KeyEvidence[] = [];
  for (const c of classifications.slice(0, 3)) {
    if (c.supporting_quotes.length > 0) {
      const q = c.supporting_quotes[0];
      keyEvidence.push({
        tweet_id: q.tweet_id,
        role: "supporting",
        quote: q.quote_text,
      });
    }
  }
  for (const ce of contradictionEvidence) {
    if (!keyEvidence.some((k) => k.tweet_id === ce.tweet_id)) {
      keyEvidence.push(ce);
    }
  }

  // Summary (<=500 chars)
  const summaryParts: string[] = [];
  for (const c of classifications.slice(0, 3)) {
    summaryParts.push(
      `${formatClassificationType(c.type)} (${c.support_count} tweets, conf ${c.llm_aggregated_confidence.toFixed(2)})`,
    );
  }
  if (contradictionDetected) {
    summaryParts.push("Contradictions detected among sources.");
  }
  const summary = summaryParts.join("; ").slice(0, 500);

  return {
    event_id: eventId,
    window_start: windowStart,
    window_end: windowEnd,
    raw_tweet_ids: tweets.map((t) => t.tweet_id),
    source_reliability_tag: "social_news",
    aggregated_confidence: round4(aggregatedConfidence),
    classifications,
    summary: summary || "no relevant tweets in window",
    contradiction_detected: contradictionDetected,
    key_evidence: keyEvidence,
    method_version: "tweet-agg-v1",
    timestamp,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function formatClassificationType(type: ClassificationType): string {
  return type
    .replace("SIGNAL_", "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}

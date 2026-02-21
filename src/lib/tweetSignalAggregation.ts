// Signal classification types — defined here to avoid dependency on needLevelEngine
export type ClassificationType =
  | "SIGNAL_DEMAND_INCREASE"
  | "SIGNAL_INSUFFICIENCY"
  | "SIGNAL_STABILIZATION"
  | "SIGNAL_FRAGILITY_ALERT"
  | "SIGNAL_COVERAGE_ACTIVITY"
  | "SIGNAL_BOTTLENECK";

export type SourceReliability = "Twitter" | "Institutional" | "NGO" | "Original Context";

// ── Input types ──────────────────────────────────────────────────────

export interface TweetInput {
  tweet_id: string;
  author_handle: string;
  author_type_estimate: "institutional" | "ngo" | "social_news";
  created_at: string; // ISO 8601
  text: string;
  retweet_count: number;
  reply_count: number;
}

// ── Per-tweet classification (intermediate) ──────────────────────────

export interface TweetClassification {
  tweet_id: string;
  type: ClassificationType;
  confidence: number;
}

// ── Output types (matches issue #5 schema) ───────────────────────────

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

export interface AggregatedTweetSignal {
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

// ── Classification patterns ──────────────────────────────────────────

const CLASSIFICATION_PATTERNS: {
  type: ClassificationType;
  patterns: RegExp[];
  augmentationPatterns?: RegExp[];
}[] = [
  {
    type: "SIGNAL_DEMAND_INCREASE",
    patterns: [
      /\b(necesit\w*|urgente?\w*|emergencia\w*|auxilio|ayuda|socorro|demand\w*|necesidad\w*|faltan?\w*|piden?)\b/i,
      /\b(need\w*|urgent\w*|help|emergency|demand\w*|require\w*|shortage)\b/i,
      /\bmás (agua|comida|medicinas|médicos|refugio)\b/i,
    ],
  },
  {
    type: "SIGNAL_INSUFFICIENCY",
    patterns: [
      /\bno alcanza|insuficient\w*|saturad\w*|\bsin (agua|comida|luz|médicos)|colapso|desbordad\w*/i,
      /\b(insufficient|overwhelmed|saturated|not enough|capacity exceeded|collapsed)\b/i,
      /\bno hay\b|agotad\w*|escas[oe]z/i,
    ],
  },
  {
    type: "SIGNAL_STABILIZATION",
    patterns: [
      /\b(operando|estable\w*|normaliz\w*|restablec\w*|mejoran\w*|controlad\w*|funcionando)\b/i,
      /\b(stable|normalized|restored|improving|controlled|operating|functional)\b/i,
      /situaci[óo]n controlada|vuelta a la normalidad/i,
    ],
  },
  {
    type: "SIGNAL_FRAGILITY_ALERT",
    patterns: [
      /\b(fragil\w*|riesgo|colapso|inestable|peligro|amenaza|advertencia)\b/i,
      /\b(fragile|risk|collapse|unstable|danger|threat|warning)\b/i,
      /puede empeorar|riesgo de colapso/i,
    ],
  },
  {
    type: "SIGNAL_COVERAGE_ACTIVITY",
    patterns: [
      /\b(lleg\w*|despacho|en camino|despleg\w*|enviando|movilizand\w*|refuerz\w*)\b/i,
      /\b(arrived|dispatched|en route|deployed|sending|mobilizing|reinforcement\w*)\b/i,
      /equipo (en|de) (camino|ruta|despliegue)/i,
    ],
    augmentationPatterns: [
      /\b(refuerz\w*|reinforcement\w*|adicional\w*|additional|despleg\w* adicional\w*)\b/i,
      /sending reinforcements|dispatching team|deploy additional|enviar refuerz\w*/i,
    ],
  },
  {
    type: "SIGNAL_BOTTLENECK",
    patterns: [
      /\b(bloqueado|obstruid\w*|cuello de botella|atascad\w*|impedid\w*)\b/i,
      /\b(blocked|obstruct\w*|bottleneck|stuck|impeded|gridlock)\b/i,
      /ruta cortada|acceso bloqueado|sin acceso/i,
    ],
  },
];

// ── Core classification function ─────────────────────────────────────

export function classifyTweet(tweet: TweetInput): TweetClassification[] {
  const results: TweetClassification[] = [];

  for (const entry of CLASSIFICATION_PATTERNS) {
    const matchCount = entry.patterns.filter((p) => p.test(tweet.text)).length;
    if (matchCount > 0) {
      const confidence = Math.min(1, matchCount * 0.35 + 0.15);
      results.push({
        tweet_id: tweet.tweet_id,
        type: entry.type,
        confidence,
      });
    }
  }

  return results;
}

// ── Augmentation detection ───────────────────────────────────────────

function hasAugmentation(text: string): boolean {
  const coverageEntry = CLASSIFICATION_PATTERNS.find(
    (e) => e.type === "SIGNAL_COVERAGE_ACTIVITY",
  );
  return coverageEntry?.augmentationPatterns?.some((p) => p.test(text)) ?? false;
}

// ── Contradiction detection ──────────────────────────────────────────

const CONTRADICTION_PAIRS: [ClassificationType, ClassificationType][] = [
  ["SIGNAL_STABILIZATION", "SIGNAL_DEMAND_INCREASE"],
  ["SIGNAL_STABILIZATION", "SIGNAL_INSUFFICIENCY"],
  ["SIGNAL_COVERAGE_ACTIVITY", "SIGNAL_INSUFFICIENCY"],
];

function detectContradictions(
  classificationsByType: Map<ClassificationType, TweetClassification[]>,
): { detected: boolean; pairs: [ClassificationType, ClassificationType][] } {
  const contradictionPairs: [ClassificationType, ClassificationType][] = [];

  for (const [typeA, typeB] of CONTRADICTION_PAIRS) {
    const countA = classificationsByType.get(typeA)?.length ?? 0;
    const countB = classificationsByType.get(typeB)?.length ?? 0;
    if (countA >= 2 && countB >= 2) {
      contradictionPairs.push([typeA, typeB]);
    }
  }

  return { detected: contradictionPairs.length > 0, pairs: contradictionPairs };
}

// ── Main aggregation function ────────────────────────────────────────

export function aggregateTweetSignals(
  tweets: TweetInput[],
  eventId: string,
): AggregatedTweetSignal {
  const now = new Date().toISOString();

  if (tweets.length === 0) {
    return {
      event_id: eventId,
      window_start: now,
      window_end: now,
      raw_tweet_ids: [],
      source_reliability_tag: "social_news",
      aggregated_confidence: 0,
      classifications: [],
      summary: "no relevant tweets in window",
      contradiction_detected: false,
      key_evidence: [],
      method_version: "deterministic-v1",
      timestamp: now,
    };
  }

  // Sort tweets by creation time
  const sorted = [...tweets].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const windowStart = sorted[0].created_at;
  const windowEnd = sorted[sorted.length - 1].created_at;

  // Classify all tweets
  const allClassifications: TweetClassification[] = [];
  const tweetMap = new Map<string, TweetInput>();

  for (const tweet of tweets) {
    tweetMap.set(tweet.tweet_id, tweet);
    const tweetClassifications = classifyTweet(tweet);
    allClassifications.push(...tweetClassifications);
  }

  // Group by classification type
  const byType = new Map<ClassificationType, TweetClassification[]>();
  for (const c of allClassifications) {
    const existing = byType.get(c.type) ?? [];
    existing.push(c);
    byType.set(c.type, existing);
  }

  // Detect contradictions
  const contradictions = detectContradictions(byType);

  // Build aggregated classifications
  const aggregatedClassifications: AggregatedClassification[] = [];

  for (const [type, classifications] of byType.entries()) {
    const supportCount = classifications.length;
    const deterministicConfidence =
      supportCount > 0
        ? classifications.reduce((sum, c) => sum + c.confidence, 0) / supportCount
        : 0;

    // LLM confidence is set to 0 in deterministic mode (no LLM available)
    const llmConfidence = 0;

    const quotes: SupportingQuote[] = classifications.map((c) => {
      const tweet = tweetMap.get(c.tweet_id)!;
      return {
        tweet_id: c.tweet_id,
        author_handle: tweet.author_handle,
        created_at: tweet.created_at,
        quote_text: tweet.text.slice(0, 280),
        tweet_confidence: c.confidence,
      };
    });

    // Deduplicate quotes by tweet_id (a tweet may match multiple patterns for the same type)
    const seenTweetIds = new Set<string>();
    const uniqueQuotes = quotes.filter((q) => {
      if (seenTweetIds.has(q.tweet_id)) return false;
      seenTweetIds.add(q.tweet_id);
      return true;
    });

    const classification: AggregatedClassification = {
      type,
      llm_aggregated_confidence: llmConfidence,
      deterministic_agg_confidence: deterministicConfidence,
      support_count: uniqueQuotes.length,
      supporting_quotes: uniqueQuotes,
    };

    // Augmentation flag for SIGNAL_COVERAGE_ACTIVITY
    if (type === "SIGNAL_COVERAGE_ACTIVITY") {
      const hasAug = classifications.some((c) => {
        const tweet = tweetMap.get(c.tweet_id);
        return tweet ? hasAugmentation(tweet.text) : false;
      });
      classification.augmentation_flag = hasAug;
    }

    aggregatedClassifications.push(classification);
  }

  // Sort by deterministic confidence (descending)
  aggregatedClassifications.sort(
    (a, b) => b.deterministic_agg_confidence - a.deterministic_agg_confidence,
  );

  // Compute aggregated confidence (max of deterministic confidences, conservative)
  const aggregatedConfidence =
    aggregatedClassifications.length > 0
      ? Math.max(...aggregatedClassifications.map((c) => c.deterministic_agg_confidence))
      : 0;

  // Build key evidence
  const keyEvidence: KeyEvidence[] = [];

  if (contradictions.detected) {
    for (const [typeA, typeB] of contradictions.pairs) {
      const classA = byType.get(typeA)?.[0];
      const classB = byType.get(typeB)?.[0];
      if (classA) {
        const tweet = tweetMap.get(classA.tweet_id)!;
        keyEvidence.push({
          tweet_id: classA.tweet_id,
          role: "supporting",
          quote: tweet.text.slice(0, 280),
        });
      }
      if (classB) {
        const tweet = tweetMap.get(classB.tweet_id)!;
        keyEvidence.push({
          tweet_id: classB.tweet_id,
          role: "contradicting",
          quote: tweet.text.slice(0, 280),
        });
      }
    }
  } else {
    // Top supporting evidence from highest-confidence classification
    const topClassification = aggregatedClassifications[0];
    if (topClassification?.supporting_quotes.length) {
      const topQuote = topClassification.supporting_quotes[0];
      keyEvidence.push({
        tweet_id: topQuote.tweet_id,
        role: "supporting",
        quote: topQuote.quote_text,
      });
    }
  }

  // Build summary
  const typeLabels: Record<ClassificationType, string> = {
    SIGNAL_DEMAND_INCREASE: "demand increase",
    SIGNAL_INSUFFICIENCY: "insufficiency",
    SIGNAL_STABILIZATION: "stabilization",
    SIGNAL_FRAGILITY_ALERT: "fragility alert",
    SIGNAL_COVERAGE_ACTIVITY: "coverage activity",
    SIGNAL_BOTTLENECK: "bottleneck",
  };

  const topTypes = aggregatedClassifications
    .slice(0, 3)
    .map((c) => `${typeLabels[c.type]} (${c.support_count} tweets)`)
    .join(", ");

  let summary = `Aggregated ${tweets.length} tweets. Detected signals: ${topTypes || "none"}.`;
  if (contradictions.detected) {
    summary += " Contradictions detected between signals.";
  }
  summary = summary.slice(0, 500);

  return {
    event_id: eventId,
    window_start: windowStart,
    window_end: windowEnd,
    raw_tweet_ids: tweets.map((t) => t.tweet_id),
    source_reliability_tag: "social_news",
    aggregated_confidence: aggregatedConfidence,
    classifications: aggregatedClassifications,
    summary,
    contradiction_detected: contradictions.detected,
    key_evidence: keyEvidence,
    method_version: "deterministic-v1",
    timestamp: now,
  };
}

// ── Helper to convert aggregated signal → NeedLevelEngine inputs ─────

export function toNeedEngineInputs(
  aggregated: AggregatedTweetSignal,
): {
  source_type: "social_news";
  source_name: string;
  timestamp: string;
  text: string;
  geo_hint: null;
}[] {
  if (aggregated.classifications.length === 0) return [];

  // Produce one raw input per classification, preserving provenance
  return aggregated.classifications.map((c) => {
    const topQuote = c.supporting_quotes[0];
    return {
      source_type: "social_news" as const,
      source_name: topQuote ? `Twitter: @${topQuote.author_handle}` : "Twitter",
      timestamp: topQuote?.created_at ?? aggregated.timestamp,
      text: JSON.stringify({
        event_id: aggregated.event_id,
        signal_type: "social",
        content: topQuote?.quote_text ?? aggregated.summary,
        confidence: c.deterministic_agg_confidence,
        source: topQuote ? `Twitter: @${topQuote.author_handle}` : "Twitter",
        created_at: topQuote?.created_at ?? aggregated.timestamp,
        classification_type: c.type,
        support_count: c.support_count,
        batch_processed_at: aggregated.timestamp,
      }),
      geo_hint: null,
    };
  });
}

// ── Reliability mapping ──────────────────────────────────────────────

export function tweetAuthorReliability(
  authorType: TweetInput["author_type_estimate"],
): SourceReliability {
  switch (authorType) {
    case "institutional":
      return "Institutional";
    case "ngo":
      return "NGO";
    default:
      return "Twitter";
  }
}

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Types ────────────────────────────────────────────────────────────

type ClassificationType =
  | "SIGNAL_DEMAND_INCREASE"
  | "SIGNAL_INSUFFICIENCY"
  | "SIGNAL_STABILIZATION"
  | "SIGNAL_FRAGILITY_ALERT"
  | "SIGNAL_COVERAGE_ACTIVITY"
  | "SIGNAL_BOTTLENECK";

interface TweetInput {
  tweet_id: string;
  author_handle: string;
  author_type_estimate: "institutional" | "ngo" | "social_news";
  created_at: string;
  text: string;
  retweet_count: number;
  reply_count: number;
}

interface TweetClassification {
  tweet_id: string;
  type: ClassificationType;
  confidence: number;
}

interface SupportingQuote {
  tweet_id: string;
  author_handle: string;
  created_at: string;
  quote_text: string;
  tweet_confidence: number;
}

interface AggregatedClassification {
  type: ClassificationType;
  deterministic_agg_confidence: number;
  support_count: number;
  supporting_quotes: SupportingQuote[];
}

interface AggregatedTweetSignal {
  event_id: string;
  window_start: string;
  window_end: string;
  raw_tweet_ids: string[];
  source_reliability_tag: "social_news";
  aggregated_confidence: number;
  classifications: AggregatedClassification[];
  summary: string;
  contradiction_detected: boolean;
  method_version: string;
  timestamp: string;
}

// ── Classification patterns ──────────────────────────────────────────

const CLASSIFICATION_PATTERNS: {
  type: ClassificationType;
  patterns: RegExp[];
}[] = [
  {
    type: "SIGNAL_DEMAND_INCREASE",
    patterns: [
      /\b(necesit\w*|urgente?\w*|emergencia\w*|auxilio|ayuda|socorro|demand\w*|necesidad\w*|faltan?)\b/i,
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

function classifyTweet(tweet: TweetInput): TweetClassification[] {
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

const CONTRADICTION_PAIRS: [ClassificationType, ClassificationType][] = [
  ["SIGNAL_STABILIZATION", "SIGNAL_DEMAND_INCREASE"],
  ["SIGNAL_STABILIZATION", "SIGNAL_INSUFFICIENCY"],
  ["SIGNAL_COVERAGE_ACTIVITY", "SIGNAL_INSUFFICIENCY"],
];

function aggregateTweetSignals(
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
      method_version: "deterministic-v1",
      timestamp: now,
    };
  }

  const sorted = [...tweets].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const windowStart = sorted[0].created_at;
  const windowEnd = sorted[sorted.length - 1].created_at;

  const allClassifications: TweetClassification[] = [];
  const tweetMap = new Map<string, TweetInput>();

  for (const tweet of tweets) {
    tweetMap.set(tweet.tweet_id, tweet);
    allClassifications.push(...classifyTweet(tweet));
  }

  const byType = new Map<ClassificationType, TweetClassification[]>();
  for (const c of allClassifications) {
    const existing = byType.get(c.type) ?? [];
    existing.push(c);
    byType.set(c.type, existing);
  }

  let contradictionDetected = false;
  for (const [typeA, typeB] of CONTRADICTION_PAIRS) {
    const countA = byType.get(typeA)?.length ?? 0;
    const countB = byType.get(typeB)?.length ?? 0;
    if (countA >= 2 && countB >= 2) {
      contradictionDetected = true;
      break;
    }
  }

  const aggregatedClassifications: AggregatedClassification[] = [];

  for (const [type, classifications] of byType.entries()) {
    const deterministicConfidence =
      classifications.reduce((sum, c) => sum + c.confidence, 0) /
      classifications.length;

    const seenTweetIds = new Set<string>();
    const quotes: SupportingQuote[] = classifications
      .map((c) => {
        const tweet = tweetMap.get(c.tweet_id)!;
        return {
          tweet_id: c.tweet_id,
          author_handle: tweet.author_handle,
          created_at: tweet.created_at,
          quote_text: tweet.text.slice(0, 280),
          tweet_confidence: c.confidence,
        };
      })
      .filter((q) => {
        if (seenTweetIds.has(q.tweet_id)) return false;
        seenTweetIds.add(q.tweet_id);
        return true;
      });

    aggregatedClassifications.push({
      type,
      deterministic_agg_confidence: deterministicConfidence,
      support_count: quotes.length,
      supporting_quotes: quotes,
    });
  }

  aggregatedClassifications.sort(
    (a, b) => b.deterministic_agg_confidence - a.deterministic_agg_confidence,
  );

  const aggregatedConfidence =
    aggregatedClassifications.length > 0
      ? Math.max(
          ...aggregatedClassifications.map(
            (c) => c.deterministic_agg_confidence,
          ),
        )
      : 0;

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
  if (contradictionDetected) {
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
    contradiction_detected: contradictionDetected,
    method_version: "deterministic-v1",
    timestamp: now,
  };
}

// ── Twitter API v2 ───────────────────────────────────────────────────

async function fetchRecentTweets(
  query: string,
  bearerToken: string,
): Promise<Record<string, unknown>> {
  const params = new URLSearchParams({
    query,
    "tweet.fields": "created_at,public_metrics,author_id",
    expansions: "author_id",
    "user.fields": "username",
    max_results: "20",
  });

  const url = `https://api.x.com/2/tweets/search/recent?${params.toString()}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${bearerToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Twitter API error ${response.status}: ${errorText}`);
  }

  return await response.json();
}

function mapApiTweetsToInput(
  apiResponse: Record<string, unknown>,
): TweetInput[] {
  const data = (apiResponse.data ?? []) as Array<{
    id: string;
    text: string;
    created_at?: string;
    author_id?: string;
    public_metrics?: {
      retweet_count?: number;
      reply_count?: number;
    };
  }>;

  const includes = apiResponse.includes as
    | { users?: Array<{ id: string; username: string }> }
    | undefined;

  const userMap = new Map<string, string>();
  if (includes?.users) {
    for (const user of includes.users) {
      userMap.set(user.id, user.username);
    }
  }

  return data.map((tweet) => ({
    tweet_id: tweet.id,
    author_handle: userMap.get(tweet.author_id ?? "") ?? "unknown",
    author_type_estimate: "social_news" as const,
    created_at: tweet.created_at ?? new Date().toISOString(),
    text: tweet.text,
    retweet_count: tweet.public_metrics?.retweet_count ?? 0,
    reply_count: tweet.public_metrics?.reply_count ?? 0,
  }));
}

// ── Edge function handler ────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { event_id, query, sector_id } = await req.json();

    if (!event_id || !query) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: event_id, query",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const bearerToken = Deno.env.get("TWITTER_BEARER_TOKEN");
    if (!bearerToken) {
      return new Response(
        JSON.stringify({ error: "TWITTER_BEARER_TOKEN secret is not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(
      `Fetching tweets for event ${event_id}, query: "${query}", sector: ${sector_id ?? "none"
      }`,
    );

    // 1. Fetch real tweets from Twitter API v2
    const apiResponse = await fetchRecentTweets(query, bearerToken);
    console.log("Twitter API response received, result_count:", (apiResponse.meta as any)?.result_count ?? 0);

    // 2. Map to TweetInput[]
    const tweets = mapApiTweetsToInput(apiResponse);
    console.log(`Mapped ${tweets.length} tweets from API response`);

    if (tweets.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          aggregated: aggregateTweetSignals([], event_id),
          tweets_found: 0,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 3. Classify and aggregate
    const aggregated = aggregateTweetSignals(tweets, event_id);

    // 4. Store signals in DB
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    for (const classification of aggregated.classifications) {
      const topQuote = classification.supporting_quotes[0];
      const { error: signalError } = await supabase.from("signals").insert({
        event_id,
        sector_id: sector_id ?? null,
        signal_type: "social",
        level: sector_id ? "sector" : "event",
        content: JSON.stringify({
          classification_type: classification.type,
          confidence: classification.deterministic_agg_confidence,
          support_count: classification.support_count,
          quote: topQuote?.quote_text ?? aggregated.summary,
        }),
        source: topQuote
          ? `Twitter: @${topQuote.author_handle}`
          : "Twitter API",
        confidence: classification.deterministic_agg_confidence,
      });

      if (signalError) {
        console.error("Signal insert error:", signalError);
      }
    }

    console.log(
      `Stored ${aggregated.classifications.length} signals for event ${event_id}`,
    );

    // 5. Return aggregated result
    return new Response(
      JSON.stringify({
        success: true,
        aggregated,
        tweets_found: tweets.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: unknown) {
    console.error("Error in fetch-tweets:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

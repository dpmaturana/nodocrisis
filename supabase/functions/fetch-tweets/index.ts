import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Inlined classification types & patterns (from src/lib/tweetSignalAggregation.ts) ──

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

const CLASSIFICATION_PATTERNS: {
  type: ClassificationType;
  patterns: RegExp[];
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

  // Contradiction detection
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

// ── Tweet parsing from xAI response ──────────────────────────────────

function parseTweetsFromResponse(responseText: string): TweetInput[] {
  const tweets: TweetInput[] = [];
  // Split on common tweet-like boundaries (lines that look like separate tweets)
  const lines = responseText.split(/\n+/).filter((l) => l.trim().length > 20);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Try to extract @handle
    const handleMatch = line.match(/@(\w{1,15})/);
    const handle = handleMatch ? handleMatch[1] : `user_${i}`;

    tweets.push({
      tweet_id: `xai_${crypto.randomUUID()}`,
      author_handle: handle,
      author_type_estimate: "social_news",
      created_at: new Date().toISOString(),
      text: line.slice(0, 500),
      retweet_count: 0,
      reply_count: 0,
    });
  }

  return tweets;
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

    // 1. Call xAI Responses API with x_search tool
    const xaiApiKey = Deno.env.get("GROK_API_KEY");
    if (!xaiApiKey) {
      return new Response(
        JSON.stringify({ error: "GROK_API_KEY secret is not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(
      `Fetching tweets for event ${event_id}, query: "${query}", sector: ${sector_id ?? "none"}`,
    );

    const xaiResponse = await fetch("https://api.x.ai/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${xaiApiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4-0709",
        tools: [{ type: "x_search" }],
        input: `Find recent tweets about ${query} related to emergency/crisis`,
      }),
    });

    if (!xaiResponse.ok) {
      const errorText = await xaiResponse.text();
      console.error("xAI API error:", xaiResponse.status, errorText);
      return new Response(
        JSON.stringify({
          error: `xAI API error: ${xaiResponse.status}`,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const xaiResult = await xaiResponse.json();
    console.log("xAI response received");

    // 2. Extract text content from the xAI response
    let responseText = "";
    if (xaiResult.output && Array.isArray(xaiResult.output)) {
      for (const item of xaiResult.output) {
        if (item.type === "message" && Array.isArray(item.content)) {
          for (const block of item.content) {
            if (block.type === "output_text" && block.text) {
              responseText += block.text + "\n";
            }
          }
        }
      }
    }

    if (!responseText.trim()) {
      console.log("No tweet content found in xAI response");
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

    // 3. Parse tweets from response text
    const tweets = parseTweetsFromResponse(responseText);
    console.log(`Parsed ${tweets.length} tweets from xAI response`);

    // 4. Classify and aggregate
    const aggregated = aggregateTweetSignals(tweets, event_id);

    // 5. Store signals in DB
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
          : "Twitter/xAI",
        confidence: classification.deterministic_agg_confidence,
      });

      if (signalError) {
        console.error("Signal insert error:", signalError);
      }
    }

    console.log(
      `Stored ${aggregated.classifications.length} signals for event ${event_id}`,
    );

    // 6. Return aggregated result
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

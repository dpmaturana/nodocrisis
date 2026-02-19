import { describe, expect, it } from "vitest";
import {
  aggregateTweetSignals,
  classifyTweet,
  toNeedEngineInputs,
  tweetAuthorReliability,
  type TweetInput,
} from "@/lib/tweetSignalAggregation";

// ── Helpers ──────────────────────────────────────────────────────────

function makeTweet(overrides: Partial<TweetInput> & { tweet_id: string }): TweetInput {
  return {
    author_handle: "testuser",
    author_type_estimate: "social_news",
    created_at: "2026-02-19T10:00:00.000Z",
    text: "tweet text",
    retweet_count: 0,
    reply_count: 0,
    ...overrides,
  };
}

// ── classifyTweet ────────────────────────────────────────────────────

describe("classifyTweet", () => {
  it("classifies demand-increase keywords", () => {
    const tweet = makeTweet({ tweet_id: "1", text: "Necesitamos ayuda urgente en la zona" });
    const results = classifyTweet(tweet);
    const types = results.map((r) => r.type);
    expect(types).toContain("SIGNAL_DEMAND_INCREASE");
  });

  it("classifies insufficiency keywords", () => {
    const tweet = makeTweet({ tweet_id: "2", text: "Hospital saturado, no hay más camas" });
    const results = classifyTweet(tweet);
    const types = results.map((r) => r.type);
    expect(types).toContain("SIGNAL_INSUFFICIENCY");
  });

  it("classifies stabilization keywords", () => {
    const tweet = makeTweet({ tweet_id: "3", text: "Situación estable, servicios restablecidos" });
    const results = classifyTweet(tweet);
    const types = results.map((r) => r.type);
    expect(types).toContain("SIGNAL_STABILIZATION");
  });

  it("classifies fragility alert keywords", () => {
    const tweet = makeTweet({ tweet_id: "4", text: "Riesgo de colapso en la estructura" });
    const results = classifyTweet(tweet);
    const types = results.map((r) => r.type);
    expect(types).toContain("SIGNAL_FRAGILITY_ALERT");
  });

  it("classifies coverage activity keywords", () => {
    const tweet = makeTweet({ tweet_id: "5", text: "Equipo de rescate en camino" });
    const results = classifyTweet(tweet);
    const types = results.map((r) => r.type);
    expect(types).toContain("SIGNAL_COVERAGE_ACTIVITY");
  });

  it("classifies bottleneck keywords", () => {
    const tweet = makeTweet({ tweet_id: "6", text: "Ruta cortada, acceso bloqueado al sector" });
    const results = classifyTweet(tweet);
    const types = results.map((r) => r.type);
    expect(types).toContain("SIGNAL_BOTTLENECK");
  });

  it("returns empty array for unrelated text", () => {
    const tweet = makeTweet({ tweet_id: "7", text: "Buenos días, hoy hace buen tiempo" });
    const results = classifyTweet(tweet);
    expect(results).toHaveLength(0);
  });

  it("returns multiple classifications for multi-signal tweet", () => {
    const tweet = makeTweet({
      tweet_id: "8",
      text: "Hospital saturado, necesitamos ayuda urgente, riesgo de colapso",
    });
    const results = classifyTweet(tweet);
    const types = results.map((r) => r.type);
    expect(types.length).toBeGreaterThanOrEqual(2);
    expect(types).toContain("SIGNAL_INSUFFICIENCY");
    expect(types).toContain("SIGNAL_DEMAND_INCREASE");
  });
});

// ── aggregateTweetSignals ────────────────────────────────────────────

describe("aggregateTweetSignals", () => {
  it("returns empty result for no tweets", () => {
    const result = aggregateTweetSignals([], "event-1");
    expect(result.event_id).toBe("event-1");
    expect(result.source_reliability_tag).toBe("social_news");
    expect(result.aggregated_confidence).toBe(0);
    expect(result.classifications).toHaveLength(0);
    expect(result.summary).toBe("no relevant tweets in window");
    expect(result.contradiction_detected).toBe(false);
    expect(result.raw_tweet_ids).toHaveLength(0);
  });

  it("aggregates tweets into correct classification types", () => {
    const tweets: TweetInput[] = [
      makeTweet({ tweet_id: "t1", text: "Necesitamos ayuda urgente", created_at: "2026-02-19T10:00:00Z" }),
      makeTweet({ tweet_id: "t2", text: "Ayuda necesaria en el sector norte", created_at: "2026-02-19T10:05:00Z" }),
      makeTweet({ tweet_id: "t3", text: "Equipo de rescate en camino", created_at: "2026-02-19T10:10:00Z" }),
    ];

    const result = aggregateTweetSignals(tweets, "event-1");

    expect(result.raw_tweet_ids).toEqual(["t1", "t2", "t3"]);
    expect(result.window_start).toBe("2026-02-19T10:00:00Z");
    expect(result.window_end).toBe("2026-02-19T10:10:00Z");

    const types = result.classifications.map((c) => c.type);
    expect(types).toContain("SIGNAL_DEMAND_INCREASE");
    expect(types).toContain("SIGNAL_COVERAGE_ACTIVITY");
  });

  it("computes deterministic_agg_confidence as average per type", () => {
    const tweets: TweetInput[] = [
      makeTweet({ tweet_id: "t1", text: "Necesitamos ayuda urgente" }),
      makeTweet({ tweet_id: "t2", text: "Urgente: faltan medicinas" }),
    ];

    const result = aggregateTweetSignals(tweets, "event-1");
    const demandClass = result.classifications.find(
      (c) => c.type === "SIGNAL_DEMAND_INCREASE",
    );
    expect(demandClass).toBeDefined();
    expect(demandClass!.deterministic_agg_confidence).toBeGreaterThan(0);
    expect(demandClass!.deterministic_agg_confidence).toBeLessThanOrEqual(1);
  });

  it("sets llm_aggregated_confidence to 0 in deterministic mode", () => {
    const tweets: TweetInput[] = [
      makeTweet({ tweet_id: "t1", text: "Necesitamos ayuda urgente" }),
    ];
    const result = aggregateTweetSignals(tweets, "event-1");
    for (const c of result.classifications) {
      expect(c.llm_aggregated_confidence).toBe(0);
    }
  });

  it("detects contradictions when opposing signals have >= 2 tweets each", () => {
    const tweets: TweetInput[] = [
      makeTweet({ tweet_id: "t1", text: "Situación estable y controlada" }),
      makeTweet({ tweet_id: "t2", text: "Servicios restablecidos, normalizado" }),
      makeTweet({ tweet_id: "t3", text: "Necesitamos ayuda urgente, faltan recursos" }),
      makeTweet({ tweet_id: "t4", text: "Demanda creciente, necesitamos más ayuda" }),
    ];

    const result = aggregateTweetSignals(tweets, "event-1");
    expect(result.contradiction_detected).toBe(true);
    expect(result.key_evidence.some((e) => e.role === "contradicting")).toBe(true);
  });

  it("does not detect contradictions with fewer than 2 tweets per side", () => {
    const tweets: TweetInput[] = [
      makeTweet({ tweet_id: "t1", text: "Situación estable y controlada" }),
      makeTweet({ tweet_id: "t2", text: "Necesitamos ayuda urgente" }),
    ];

    const result = aggregateTweetSignals(tweets, "event-1");
    expect(result.contradiction_detected).toBe(false);
  });

  it("sets augmentation_flag when augmentation keywords are present", () => {
    const tweets: TweetInput[] = [
      makeTweet({ tweet_id: "t1", text: "Enviando refuerzos adicionales al sector" }),
    ];

    const result = aggregateTweetSignals(tweets, "event-1");
    const coverage = result.classifications.find(
      (c) => c.type === "SIGNAL_COVERAGE_ACTIVITY",
    );
    expect(coverage).toBeDefined();
    expect(coverage!.augmentation_flag).toBe(true);
  });

  it("does not set augmentation_flag for baseline coverage", () => {
    const tweets: TweetInput[] = [
      makeTweet({ tweet_id: "t1", text: "Equipo de rescate en camino" }),
    ];

    const result = aggregateTweetSignals(tweets, "event-1");
    const coverage = result.classifications.find(
      (c) => c.type === "SIGNAL_COVERAGE_ACTIVITY",
    );
    expect(coverage).toBeDefined();
    expect(coverage!.augmentation_flag).toBe(false);
  });

  it("includes supporting quotes with correct fields", () => {
    const tweets: TweetInput[] = [
      makeTweet({
        tweet_id: "t1",
        author_handle: "LocalReporter",
        text: "Hospital saturado, no hay más camas",
        created_at: "2026-02-19T10:30:00Z",
      }),
    ];

    const result = aggregateTweetSignals(tweets, "event-1");
    const insuff = result.classifications.find(
      (c) => c.type === "SIGNAL_INSUFFICIENCY",
    );
    expect(insuff).toBeDefined();
    expect(insuff!.supporting_quotes).toHaveLength(1);
    expect(insuff!.supporting_quotes[0]).toMatchObject({
      tweet_id: "t1",
      author_handle: "LocalReporter",
      created_at: "2026-02-19T10:30:00Z",
    });
  });

  it("produces summary within 500 characters", () => {
    const tweets: TweetInput[] = Array.from({ length: 50 }, (_, i) =>
      makeTweet({ tweet_id: `t${i}`, text: "Necesitamos ayuda urgente en la zona afectada" }),
    );
    const result = aggregateTweetSignals(tweets, "event-1");
    expect(result.summary.length).toBeLessThanOrEqual(500);
  });

  it("always sets source_reliability_tag to social_news", () => {
    const tweets: TweetInput[] = [
      makeTweet({ tweet_id: "t1", text: "Necesitamos ayuda", author_type_estimate: "institutional" }),
    ];
    const result = aggregateTweetSignals(tweets, "event-1");
    expect(result.source_reliability_tag).toBe("social_news");
  });

  it("sets method_version", () => {
    const result = aggregateTweetSignals([], "event-1");
    expect(result.method_version).toBe("deterministic-v1");
  });
});

// ── toNeedEngineInputs ───────────────────────────────────────────────

describe("toNeedEngineInputs", () => {
  it("returns empty array when no classifications", () => {
    const aggregated = aggregateTweetSignals([], "event-1");
    const inputs = toNeedEngineInputs(aggregated);
    expect(inputs).toHaveLength(0);
  });

  it("returns one input per classification", () => {
    const tweets: TweetInput[] = [
      makeTweet({ tweet_id: "t1", text: "Necesitamos ayuda urgente" }),
      makeTweet({ tweet_id: "t2", text: "Equipo en camino al sector" }),
    ];
    const aggregated = aggregateTweetSignals(tweets, "event-1");
    const inputs = toNeedEngineInputs(aggregated);
    expect(inputs.length).toBe(aggregated.classifications.length);
  });

  it("sets source_type to social_news", () => {
    const tweets: TweetInput[] = [
      makeTweet({ tweet_id: "t1", text: "Necesitamos ayuda urgente" }),
    ];
    const aggregated = aggregateTweetSignals(tweets, "event-1");
    const inputs = toNeedEngineInputs(aggregated);
    for (const input of inputs) {
      expect(input.source_type).toBe("social_news");
    }
  });

  it("includes Twitter handle in source_name", () => {
    const tweets: TweetInput[] = [
      makeTweet({
        tweet_id: "t1",
        author_handle: "DistrictAlert",
        text: "Necesitamos ayuda urgente",
      }),
    ];
    const aggregated = aggregateTweetSignals(tweets, "event-1");
    const inputs = toNeedEngineInputs(aggregated);
    expect(inputs[0].source_name).toContain("@DistrictAlert");
  });
});

// ── tweetAuthorReliability ───────────────────────────────────────────

describe("tweetAuthorReliability", () => {
  it("maps institutional to Institutional", () => {
    expect(tweetAuthorReliability("institutional")).toBe("Institutional");
  });

  it("maps ngo to NGO", () => {
    expect(tweetAuthorReliability("ngo")).toBe("NGO");
  });

  it("maps social_news to Social/News", () => {
    expect(tweetAuthorReliability("social_news")).toBe("Social/News");
  });
});

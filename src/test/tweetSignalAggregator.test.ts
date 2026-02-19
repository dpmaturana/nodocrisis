import { describe, expect, it } from "vitest";
import {
  aggregateTweets,
  type Tweet,
  type AggregatedSignal,
} from "@/lib/tweetSignalAggregator";

const now = "2026-02-16T10:00:00.000Z";

function makeTweet(overrides: Partial<Tweet> & Pick<Tweet, "tweet_id" | "text">): Tweet {
  return {
    author_handle: "@testuser",
    author_type_estimate: "social_news",
    created_at: now,
    retweet_count: 0,
    reply_count: 0,
    ...overrides,
  };
}

describe("aggregateTweets", () => {
  it("returns empty classifications and zero confidence for no tweets", () => {
    const result = aggregateTweets("evt-1", [], now);

    expect(result.event_id).toBe("evt-1");
    expect(result.classifications).toEqual([]);
    expect(result.aggregated_confidence).toBe(0);
    expect(result.summary).toBe("no relevant tweets in window");
    expect(result.source_reliability_tag).toBe("social_news");
    expect(result.contradiction_detected).toBe(false);
    expect(result.method_version).toBe("tweet-agg-v1");
  });

  it("classifies a demand increase tweet", () => {
    const tweets: Tweet[] = [
      makeTweet({ tweet_id: "t1", text: "We urgently need help in the affected area" }),
    ];

    const result = aggregateTweets("evt-2", tweets, now);

    expect(result.classifications.length).toBeGreaterThanOrEqual(1);
    const demand = result.classifications.find(
      (c) => c.type === "SIGNAL_DEMAND_INCREASE",
    );
    expect(demand).toBeDefined();
    expect(demand!.support_count).toBe(1);
    expect(demand!.supporting_quotes.length).toBe(1);
    expect(demand!.supporting_quotes[0].tweet_id).toBe("t1");
    expect(demand!.llm_aggregated_confidence).toBeGreaterThan(0);
  });

  it("classifies insufficiency signals", () => {
    const tweets: Tweet[] = [
      makeTweet({ tweet_id: "t1", text: "Supplies are insufficient for the population" }),
      makeTweet({ tweet_id: "t2", text: "Running out of water, not enough resources" }),
    ];

    const result = aggregateTweets("evt-3", tweets, now);

    const insuff = result.classifications.find(
      (c) => c.type === "SIGNAL_INSUFFICIENCY",
    );
    expect(insuff).toBeDefined();
    expect(insuff!.support_count).toBe(2);
  });

  it("classifies coverage activity and detects augmentation flag", () => {
    const tweets: Tweet[] = [
      makeTweet({ tweet_id: "t1", text: "Rescue team arrived on-site" }),
      makeTweet({ tweet_id: "t2", text: "We will deploy additional resources to area" }),
    ];

    const result = aggregateTweets("evt-4", tweets, now);

    const coverage = result.classifications.find(
      (c) => c.type === "SIGNAL_COVERAGE_ACTIVITY",
    );
    expect(coverage).toBeDefined();
    expect(coverage!.augmentation_flag).toBe(true);
  });

  it("sets augmentation_flag false when no augmentation phrases present", () => {
    const tweets: Tweet[] = [
      makeTweet({ tweet_id: "t1", text: "Rescue team arrived on-site" }),
    ];

    const result = aggregateTweets("evt-5", tweets, now);

    const coverage = result.classifications.find(
      (c) => c.type === "SIGNAL_COVERAGE_ACTIVITY",
    );
    expect(coverage).toBeDefined();
    expect(coverage!.augmentation_flag).toBe(false);
  });

  it("does not set augmentation_flag on non-coverage classifications", () => {
    const tweets: Tweet[] = [
      makeTweet({ tweet_id: "t1", text: "We urgently need help!" }),
    ];

    const result = aggregateTweets("evt-6", tweets, now);

    for (const c of result.classifications) {
      if (c.type !== "SIGNAL_COVERAGE_ACTIVITY") {
        expect(c.augmentation_flag).toBeUndefined();
      }
    }
  });

  it("detects contradictions when opposing claims have sufficient support", () => {
    const tweets: Tweet[] = [
      makeTweet({ tweet_id: "t1", text: "Teams are on-site and responding" }),
      makeTweet({ tweet_id: "t2", text: "Deployed teams arrived at location" }),
      makeTweet({ tweet_id: "t3", text: "No team arrived yet, nobody came" }),
      makeTweet({ tweet_id: "t4", text: "No team has been deployed, nobody here" }),
    ];

    const result = aggregateTweets("evt-7", tweets, now);

    expect(result.contradiction_detected).toBe(true);
    expect(result.key_evidence.some((e) => e.role === "contradicting")).toBe(true);
  });

  it("does not detect contradiction when only one side has support", () => {
    const tweets: Tweet[] = [
      makeTweet({ tweet_id: "t1", text: "Teams are on-site" }),
      makeTweet({ tweet_id: "t2", text: "Teams arrived at location" }),
    ];

    const result = aggregateTweets("evt-8", tweets, now);

    expect(result.contradiction_detected).toBe(false);
  });

  it("computes time window from tweet timestamps", () => {
    const tweets: Tweet[] = [
      makeTweet({ tweet_id: "t1", text: "Need help!", created_at: "2026-02-16T08:00:00.000Z" }),
      makeTweet({ tweet_id: "t2", text: "Emergency help needed", created_at: "2026-02-16T12:00:00.000Z" }),
    ];

    const result = aggregateTweets("evt-9", tweets, now);

    expect(result.window_start).toBe("2026-02-16T08:00:00.000Z");
    expect(result.window_end).toBe("2026-02-16T12:00:00.000Z");
  });

  it("collects all raw tweet ids", () => {
    const tweets: Tweet[] = [
      makeTweet({ tweet_id: "t1", text: "Need help!" }),
      makeTweet({ tweet_id: "t2", text: "Situation is stabilizing" }),
      makeTweet({ tweet_id: "t3", text: "More resources needed" }),
    ];

    const result = aggregateTweets("evt-10", tweets, now);

    expect(result.raw_tweet_ids).toEqual(["t1", "t2", "t3"]);
  });

  it("uses pre-classified tweet labels for deterministic_agg_confidence", () => {
    const tweets: Tweet[] = [
      makeTweet({
        tweet_id: "t1",
        text: "custom classified tweet",
        classification: { type: "SIGNAL_DEMAND_INCREASE", confidence: 0.8 },
      }),
      makeTweet({
        tweet_id: "t2",
        text: "another classified tweet",
        classification: { type: "SIGNAL_DEMAND_INCREASE", confidence: 0.6 },
      }),
    ];

    const result = aggregateTweets("evt-11", tweets, now);

    const demand = result.classifications.find(
      (c) => c.type === "SIGNAL_DEMAND_INCREASE",
    );
    expect(demand).toBeDefined();
    // (0.8 + 0.6) / 2 = 0.7
    expect(demand!.deterministic_agg_confidence).toBeCloseTo(0.7, 2);
  });

  it("sets deterministic_agg_confidence to 0 when no per-tweet classifications", () => {
    const tweets: Tweet[] = [
      makeTweet({ tweet_id: "t1", text: "We urgently need help" }),
    ];

    const result = aggregateTweets("evt-12", tweets, now);

    const demand = result.classifications.find(
      (c) => c.type === "SIGNAL_DEMAND_INCREASE",
    );
    expect(demand).toBeDefined();
    expect(demand!.deterministic_agg_confidence).toBe(0);
  });

  it("aggregated_confidence does not exceed max llm_aggregated_confidence", () => {
    const tweets: Tweet[] = [
      makeTweet({ tweet_id: "t1", text: "Situation is stabilizing and under control" }),
      makeTweet({ tweet_id: "t2", text: "We urgently need emergency help" }),
    ];

    const result = aggregateTweets("evt-13", tweets, now);

    const maxLlm = Math.max(
      ...result.classifications.map((c) => c.llm_aggregated_confidence),
    );
    expect(result.aggregated_confidence).toBe(maxLlm);
  });

  it("limits summary to 500 characters", () => {
    // Create many tweets to produce a long summary
    const tweets: Tweet[] = Array.from({ length: 20 }, (_, i) =>
      makeTweet({
        tweet_id: `t${i}`,
        text: `Emergency situation requires urgent help and resources for the population area ${i}`,
      }),
    );

    const result = aggregateTweets("evt-14", tweets, now);

    expect(result.summary.length).toBeLessThanOrEqual(500);
  });

  it("always sets source_reliability_tag to social_news", () => {
    const tweets: Tweet[] = [
      makeTweet({
        tweet_id: "t1",
        text: "Official report from agency",
        author_type_estimate: "institutional",
      }),
    ];

    const result = aggregateTweets("evt-15", tweets, now);

    expect(result.source_reliability_tag).toBe("social_news");
  });

  it("produces valid schema output with all required fields", () => {
    const tweets: Tweet[] = [
      makeTweet({ tweet_id: "t1", text: "We desperately need help, SOS!" }),
    ];

    const result = aggregateTweets("evt-16", tweets, now);

    // Verify all required top-level fields exist
    const requiredFields: (keyof AggregatedSignal)[] = [
      "event_id",
      "window_start",
      "window_end",
      "raw_tweet_ids",
      "source_reliability_tag",
      "aggregated_confidence",
      "classifications",
      "summary",
      "contradiction_detected",
      "key_evidence",
      "method_version",
      "timestamp",
    ];

    for (const field of requiredFields) {
      expect(result).toHaveProperty(field);
    }

    // No extra top-level fields
    expect(Object.keys(result).sort()).toEqual(requiredFields.sort());

    // Verify classification shape
    for (const c of result.classifications) {
      expect(c).toHaveProperty("type");
      expect(c).toHaveProperty("llm_aggregated_confidence");
      expect(c).toHaveProperty("deterministic_agg_confidence");
      expect(c).toHaveProperty("support_count");
      expect(c).toHaveProperty("supporting_quotes");
      expect(c.llm_aggregated_confidence).toBeGreaterThanOrEqual(0);
      expect(c.llm_aggregated_confidence).toBeLessThanOrEqual(1);
    }
  });

  it("classifies stabilization signals", () => {
    const tweets: Tweet[] = [
      makeTweet({ tweet_id: "t1", text: "The area has been stabilized, situation under control" }),
    ];

    const result = aggregateTweets("evt-17", tweets, now);

    const stab = result.classifications.find(
      (c) => c.type === "SIGNAL_STABILIZATION",
    );
    expect(stab).toBeDefined();
    expect(stab!.support_count).toBe(1);
  });

  it("classifies fragility alerts", () => {
    const tweets: Tweet[] = [
      makeTweet({ tweet_id: "t1", text: "Infrastructure is unstable and at risk of collapse" }),
    ];

    const result = aggregateTweets("evt-18", tweets, now);

    const frag = result.classifications.find(
      (c) => c.type === "SIGNAL_FRAGILITY_ALERT",
    );
    expect(frag).toBeDefined();
  });

  it("classifies bottleneck signals", () => {
    const tweets: Tweet[] = [
      makeTweet({ tweet_id: "t1", text: "Main road is blocked, no access to the area" }),
    ];

    const result = aggregateTweets("evt-19", tweets, now);

    const bottleneck = result.classifications.find(
      (c) => c.type === "SIGNAL_BOTTLENECK",
    );
    expect(bottleneck).toBeDefined();
  });

  it("handles tweets that match multiple classification types", () => {
    const tweets: Tweet[] = [
      makeTweet({
        tweet_id: "t1",
        text: "We need urgent help, supplies are insufficient and road is blocked",
      }),
    ];

    const result = aggregateTweets("evt-20", tweets, now);

    // Should match multiple types
    expect(result.classifications.length).toBeGreaterThan(1);

    const types = result.classifications.map((c) => c.type);
    expect(types).toContain("SIGNAL_DEMAND_INCREASE");
    expect(types).toContain("SIGNAL_INSUFFICIENCY");
    expect(types).toContain("SIGNAL_BOTTLENECK");
  });
});

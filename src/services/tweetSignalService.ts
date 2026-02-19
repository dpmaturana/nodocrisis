import { needSignalService } from "@/services/needSignalService";
import {
  aggregateTweetSignals,
  toNeedEngineInputs,
  type AggregatedTweetSignal,
  type TweetInput,
} from "@/lib/tweetSignalAggregation";
import type { Signal } from "@/types/database";

export const tweetSignalService = {
  /**
   * Process a batch of tweets for a given event and produce an aggregated signal.
   * Each tweet is classified and the results are merged per classification type.
   *
   * @returns The aggregated tweet signal following the issue #5 schema
   */
  aggregateBatch(tweets: TweetInput[], eventId: string): AggregatedTweetSignal {
    return aggregateTweetSignals(tweets, eventId);
  },

  /**
   * Process a batch of tweets and feed the aggregated signals into the
   * NeedLevelEngine for a specific sector + capability pair.
   *
   * This bridges the tweet aggregation output with the existing need
   * evaluation pipeline.
   */
  async evaluateFromTweets(params: {
    tweets: TweetInput[];
    eventId: string;
    sectorId: string;
    capabilityId: string;
    nowIso?: string;
  }) {
    const aggregated = aggregateTweetSignals(params.tweets, params.eventId);

    if (aggregated.classifications.length === 0) {
      return { aggregated, needState: null };
    }

    // Convert aggregated classifications into Signal objects for the engine
    const signals: Signal[] = toNeedEngineInputs(aggregated).map((input, idx) => ({
      id: `tweet-signal-${idx}`,
      event_id: params.eventId,
      sector_id: params.sectorId,
      signal_type: "social" as const,
      level: "sector" as const,
      content: input.text,
      source: input.source_name,
      confidence: aggregated.classifications[idx]?.deterministic_agg_confidence ?? 0,
      created_at: input.timestamp,
    }));

    const needState = await needSignalService.evaluateGapNeed({
      eventId: params.eventId,
      sectorId: params.sectorId,
      capabilityId: params.capabilityId,
      signals,
      nowIso: params.nowIso,
    });

    return { aggregated, needState };
  },
};

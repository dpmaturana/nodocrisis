import { needSignalService } from "@/services/needSignalService";
import {
  aggregateTweetSignals,
  type AggregatedTweetSignal,
  type TweetInput,
  type ClassificationType,
} from "@/lib/tweetSignalAggregation";

/** Map a tweet ClassificationType to the state string used by evaluate-need */
function classificationTypeToState(type: ClassificationType): string {
  switch (type) {
    case "SIGNAL_DEMAND_INCREASE":  return "demand";
    case "SIGNAL_INSUFFICIENCY":    return "needed";
    case "SIGNAL_STABILIZATION":    return "available";
    case "SIGNAL_FRAGILITY_ALERT":  return "fragility";
    case "SIGNAL_COVERAGE_ACTIVITY": return "in_transit";
    default:                        return "needed";
  }
}

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
   * evaluate-need backend endpoint for a specific sector + capability pair.
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

    // Convert aggregated classifications into { state, confidence } pairs
    const signals = aggregated.classifications.map((c) => ({
      state: classificationTypeToState(c.type),
      confidence: c.deterministic_agg_confidence,
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

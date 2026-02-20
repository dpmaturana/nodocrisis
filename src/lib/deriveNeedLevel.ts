/**
 * Derive a NeedLevel from a list of extracted field-report items.
 *
 * Takes the **highest** urgency found among the items and maps it to the
 * corresponding DB need level.  Falls back to `"medium"` when no items are
 * provided or none carry a recognised urgency value.
 */

const URGENCY_RANK: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export type NeedLevelValue = "low" | "medium" | "high" | "critical";

export interface ExtractedItemUrgency {
  urgency: string;
}

export function deriveNeedLevel(items: ExtractedItemUrgency[]): NeedLevelValue {
  let best: NeedLevelValue | null = null;
  let bestRank = 0;

  for (const item of items) {
    const rank = URGENCY_RANK[item.urgency] ?? 0;
    if (rank > bestRank) {
      bestRank = rank;
      best = item.urgency as NeedLevelValue;
    }
  }

  return best ?? "medium";
}

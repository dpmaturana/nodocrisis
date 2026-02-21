export type ActivitySourceType = "twitter" | "institutional" | "ngo" | "original_context" | "system";

export type ActivityEventType =
  | "SIGNAL_RECEIVED"
  | "COVERAGE_ACTIVITY_EVENT"
  | "STATUS_CHANGE";

export const SOURCE_TYPE_LABELS: Record<ActivitySourceType, string> = {
  twitter: "Twitter",
  institutional: "Admin",
  ngo: "ONG",
  original_context: "Contexto Original",
  system: "Sistema",
};

export const SOURCE_TYPE_WEIGHTS: Record<ActivitySourceType, number> = {
  twitter: 0.4,
  institutional: 1,
  ngo: 1,
  original_context: 1,
  system: 1,
};

export interface CapabilityActivityLogEntry {
  id: string;
  sector_id: string;
  capability_id: string;
  event_type: ActivityEventType;
  timestamp: string;
  source_type: ActivitySourceType;
  source_name: string;
  source_weight: number;
  summary: string;
  reasoning_summary?: string;
  guardrails_applied?: string[];
  previous_status?: string;
  final_status?: string;
  metadata?: Record<string, unknown>;
  related_ids?: string[];
}

/**
 * Format a log entry summary with source attribution.
 * Format: `[SourceTypeLabel] source_name: summary`
 */
export function formatLogEntry(entry: CapabilityActivityLogEntry): string {
  const label = SOURCE_TYPE_LABELS[entry.source_type];
  return `[${label}] ${entry.source_name}: ${entry.summary}`;
}

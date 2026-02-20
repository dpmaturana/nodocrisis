import { supabase } from "@/integrations/supabase/client";
import type {
  CapabilityActivityLogEntry,
  ActivitySourceType,
} from "@/types/activityLog";
import { SOURCE_TYPE_WEIGHTS } from "@/types/activityLog";
import type { SignalType } from "@/types/database";

// ─── Helpers ─────────────────────────────────────────────────────

function mapSignalTypeToSourceType(signalType: SignalType | null | undefined): ActivitySourceType {
  if (signalType == null) return "system";
  switch (signalType) {
    case "field_report": return "ngo";
    case "actor_report": return "institutional";
    case "official": return "institutional";
    case "sms": return "twitter";
    case "social": return "twitter";
    case "news": return "original_context";
    case "context": return "original_context";
    default: return "system";
  }
}

type SignalRow = {
  id: string;
  sector_id: string | null;
  capacity_type_id: string | null;
  created_at: string;
  content: string;
  source: string;
  signal_type: SignalType;
};

function mapSignalToEntry(signal: SignalRow): CapabilityActivityLogEntry {
  const sourceType = mapSignalTypeToSourceType(signal.signal_type);
  return {
    id: signal.id,
    sector_id: signal.sector_id ?? "",
    capability_id: signal.capacity_type_id ?? "",
    event_type: "SIGNAL_RECEIVED",
    timestamp: signal.created_at,
    source_type: sourceType,
    source_name: signal.source ?? "Señal",
    source_weight: SOURCE_TYPE_WEIGHTS[sourceType],
    summary: signal.content ?? "",
  };
}

// ─── Service ─────────────────────────────────────────────────────

export const activityLogService = {
  /**
   * Get activity log entries for a specific sector + capability pair.
   */
  async getLogForNeed(
    sectorId: string,
    capabilityId: string,
  ): Promise<CapabilityActivityLogEntry[]> {
    const { data, error } = await supabase
      .from("signals")
      .select("id, sector_id, capacity_type_id, created_at, content, source, signal_type")
      .eq("sector_id", sectorId)
      .eq("capacity_type_id", capabilityId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) console.error("activityLogService.getLogForNeed:", error);
    return (data ?? []).map((s) => mapSignalToEntry(s as SignalRow));
  },

  /**
   * Get all activity log entries for a sector (across all capabilities).
   */
  async getLogForSector(sectorId: string): Promise<CapabilityActivityLogEntry[]> {
    const { data, error } = await supabase
      .from("signals")
      .select("id, sector_id, capacity_type_id, created_at, content, source, signal_type")
      .eq("sector_id", sectorId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) console.error("activityLogService.getLogForSector:", error);
    return (data ?? []).map((s) => mapSignalToEntry(s as SignalRow));
  },
};

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

type DeploymentRow = {
  id: string;
  sector_id: string;
  capacity_type_id: string;
  actor_id: string;
  status: string;
  updated_at: string;
  notes: string | null;
  profiles: {
    organization_name: string | null;
    full_name: string | null;
  } | null;
};

const DEPLOYMENT_STATUS_LABELS: Record<string, string> = {
  interested: "marked as interested",
  confirmed:  "confirmed deployment",
  operating:  "is now operating",
  suspended:  "suspended operations",
  finished:   "finished operations",
};

function mapDeploymentToEntry(row: DeploymentRow): CapabilityActivityLogEntry {
  const orgName = row.profiles?.organization_name ?? row.profiles?.full_name ?? row.actor_id;
  const statusLabel = DEPLOYMENT_STATUS_LABELS[row.status] ?? row.status;
  return {
    id: `deploy-${row.id}-${row.status}`,
    sector_id: row.sector_id,
    capability_id: row.capacity_type_id,
    event_type: "COVERAGE_ACTIVITY_EVENT",
    timestamp: row.updated_at,
    source_type: "ngo",
    source_name: orgName,
    source_weight: SOURCE_TYPE_WEIGHTS.ngo,
    summary: `${orgName} ${statusLabel}`,
  };
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

function mapAuditRowToLogEntry(row: {
  id: string;
  sector_id: string;
  capability_id: string;
  timestamp: string;
  previous_status: string;
  final_status: string;
  reasoning_summary: string;
  guardrails_applied: string[];
}): CapabilityActivityLogEntry {
  return {
    id: row.id,
    sector_id: row.sector_id,
    capability_id: row.capability_id,
    event_type: "STATUS_CHANGE",
    timestamp: row.timestamp,
    source_type: "system",
    source_name: "Motor de decisión",
    source_weight: SOURCE_TYPE_WEIGHTS.system,
    summary: `Estado cambiado de ${row.previous_status} a ${row.final_status}`,
    reasoning_summary: row.reasoning_summary,
    guardrails_applied: row.guardrails_applied,
  };
}

// ─── Service ─────────────────────────────────────────────────────

export const activityLogService = {
  /**
   * Get activity log entries for a specific sector + capability pair.
   * Merges SIGNAL_RECEIVED entries (signals table), STATUS_CHANGE entries (need_audits),
   * and COVERAGE_ACTIVITY_EVENT entries (deployments table — NGO status changes).
   */
  async getLogForNeed(
    sectorId: string,
    capabilityId: string,
  ): Promise<CapabilityActivityLogEntry[]> {
    const [signalsResult, auditsResult, deploymentsResult] = await Promise.all([
      supabase
        .from("signals")
        .select("id, sector_id, capacity_type_id, created_at, content, source, signal_type")
        .eq("sector_id", sectorId)
        .eq("capacity_type_id", capabilityId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("need_audits")
        .select("id, sector_id, capability_id, timestamp, previous_status, final_status, reasoning_summary, guardrails_applied")
        .eq("sector_id", sectorId)
        .eq("capability_id", capabilityId)
        .order("timestamp", { ascending: false })
        .limit(50),
      supabase
        .from("deployments")
        .select("id, sector_id, capacity_type_id, actor_id, status, updated_at, notes, profiles(organization_name, full_name)")
        .eq("sector_id", sectorId)
        .eq("capacity_type_id", capabilityId)
        .in("status", ["interested", "confirmed", "operating", "suspended", "finished"])
        .order("updated_at", { ascending: false })
        .limit(50),
    ]);

    if (signalsResult.error) console.error("activityLogService.getLogForNeed (signals):", signalsResult.error);
    if (auditsResult.error) console.error("activityLogService.getLogForNeed (need_audits):", auditsResult.error);
    if (deploymentsResult.error) console.error("activityLogService.getLogForNeed (deployments):", deploymentsResult.error);

    const signalEntries = (signalsResult.data ?? []).map((s) => mapSignalToEntry(s as SignalRow));
    const statusChangeEntries = (auditsResult.data ?? []).map(mapAuditRowToLogEntry);
    const deploymentEntries = (deploymentsResult.data ?? []).map((d) => mapDeploymentToEntry(d as DeploymentRow));

    return [...signalEntries, ...statusChangeEntries, ...deploymentEntries]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  },

  /**
   * Get all activity log entries for a sector (across all capabilities).
   * Merges SIGNAL_RECEIVED entries (signals table), STATUS_CHANGE entries (need_audits),
   * and COVERAGE_ACTIVITY_EVENT entries (deployments table — NGO status changes).
   */
  async getLogForSector(sectorId: string): Promise<CapabilityActivityLogEntry[]> {
    const [signalsResult, auditsResult, deploymentsResult] = await Promise.all([
      supabase
        .from("signals")
        .select("id, sector_id, capacity_type_id, created_at, content, source, signal_type")
        .eq("sector_id", sectorId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("need_audits")
        .select("id, sector_id, capability_id, timestamp, previous_status, final_status, reasoning_summary, guardrails_applied")
        .eq("sector_id", sectorId)
        .order("timestamp", { ascending: false })
        .limit(50),
      supabase
        .from("deployments")
        .select("id, sector_id, capacity_type_id, actor_id, status, updated_at, notes, profiles(organization_name, full_name)")
        .eq("sector_id", sectorId)
        .in("status", ["interested", "confirmed", "operating", "suspended", "finished"])
        .order("updated_at", { ascending: false })
        .limit(50),
    ]);

    if (signalsResult.error) console.error("activityLogService.getLogForSector (signals):", signalsResult.error);
    if (auditsResult.error) console.error("activityLogService.getLogForSector (need_audits):", auditsResult.error);
    if (deploymentsResult.error) console.error("activityLogService.getLogForSector (deployments):", deploymentsResult.error);

    const signalEntries = (signalsResult.data ?? []).map((s) => mapSignalToEntry(s as SignalRow));
    const statusChangeEntries = (auditsResult.data ?? []).map(mapAuditRowToLogEntry);
    const deploymentEntries = (deploymentsResult.data ?? []).map((d) => mapDeploymentToEntry(d as DeploymentRow));

    return [...signalEntries, ...statusChangeEntries, ...deploymentEntries]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  },
};

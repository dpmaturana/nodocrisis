import { simulateDelay } from "./mock/delay";
import type {
  CapabilityActivityLogEntry,
  ActivitySourceType,
  ActivityEventType,
} from "@/types/activityLog";
import { SOURCE_TYPE_WEIGHTS } from "@/types/activityLog";
import { supabase } from "@/integrations/supabase/client";

// ─── Mock Activity Log Entries ───────────────────────────────────

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600_000).toISOString();
}

const MOCK_ACTIVITY_LOG: CapabilityActivityLogEntry[] = [
  // Twitter signals
  {
    id: "log-1",
    sector_id: "sec-mock-1",
    capability_id: "cap-4",
    event_type: "SIGNAL_RECEIVED",
    timestamp: hoursAgo(2),
    source_type: "twitter",
    source_name: "@bombaborealchile",
    source_weight: SOURCE_TYPE_WEIGHTS.twitter,
    summary: "Reportan heridos sin atención en sector norte de Chillán",
    metadata: { batch_processed_at: hoursAgo(1.5) },
  },
  {
    id: "log-2",
    sector_id: "sec-mock-1",
    capability_id: "cap-4",
    event_type: "SIGNAL_RECEIVED",
    timestamp: hoursAgo(3),
    source_type: "twitter",
    source_name: "@redaborealchile",
    source_weight: SOURCE_TYPE_WEIGHTS.twitter,
    summary: "Evacuados reportan falta de atención médica en albergue",
    metadata: { batch_processed_at: hoursAgo(2.5) },
  },
  // Institutional signals
  {
    id: "log-3",
    sector_id: "sec-mock-1",
    capability_id: "cap-4",
    event_type: "SIGNAL_RECEIVED",
    timestamp: hoursAgo(1),
    source_type: "institutional",
    source_name: "SENAPRED",
    source_weight: SOURCE_TYPE_WEIGHTS.institutional,
    summary: "Confirma necesidad urgente de equipos médicos en zona de incendios",
  },
  {
    id: "log-4",
    sector_id: "sec-mock-1",
    capability_id: "cap-1",
    event_type: "COVERAGE_ACTIVITY_EVENT",
    timestamp: hoursAgo(4),
    source_type: "institutional",
    source_name: "ONEMI",
    source_weight: SOURCE_TYPE_WEIGHTS.institutional,
    summary: "Despliegue de buses de evacuación confirmado para 200 personas",
  },
  // NGO signals
  {
    id: "log-5",
    sector_id: "sec-mock-1",
    capability_id: "cap-8",
    event_type: "COVERAGE_ACTIVITY_EVENT",
    timestamp: hoursAgo(5),
    source_type: "ngo",
    source_name: "Cruz Roja Chile",
    source_weight: SOURCE_TYPE_WEIGHTS.ngo,
    summary: "Compromiso de distribución de kits de alimentación para 500 familias",
  },
  {
    id: "log-6",
    sector_id: "sec-mock-2",
    capability_id: "cap-6",
    event_type: "SIGNAL_RECEIVED",
    timestamp: hoursAgo(6),
    source_type: "ngo",
    source_name: "Bomberos de Chile",
    source_weight: SOURCE_TYPE_WEIGHTS.ngo,
    summary: "Detectan contaminación de fuentes de agua en sector poniente",
  },
  // Original Context signals
  {
    id: "log-7",
    sector_id: "sec-mock-1",
    capability_id: "cap-4",
    event_type: "SIGNAL_RECEIVED",
    timestamp: hoursAgo(0.5),
    source_type: "original_context",
    source_name: "Analista — J. Pérez",
    source_weight: SOURCE_TYPE_WEIGHTS.original_context,
    summary: "Capacidad hospitalaria al límite; priorizar traslado a hospital regional",
  },
  {
    id: "log-8",
    sector_id: "sec-mock-2",
    capability_id: "cap-9",
    event_type: "COVERAGE_ACTIVITY_EVENT",
    timestamp: hoursAgo(7),
    source_type: "original_context",
    source_name: "Sistema",
    source_weight: SOURCE_TYPE_WEIGHTS.original_context,
    summary: "Albergue municipal habilitado con capacidad para 300 personas",
  },
  {
    id: "log-9",
    sector_id: "sec-mock-1",
    capability_id: "cap-4",
    event_type: "STATUS_CHANGE",
    timestamp: hoursAgo(1),
    source_type: "original_context",
    source_name: "Sistema",
    source_weight: SOURCE_TYPE_WEIGHTS.original_context,
    summary: "Estado cambiado de YELLOW a RED — demanda fuerte sin cobertura activa",
  },
  {
    id: "log-10",
    sector_id: "sec-mock-2",
    capability_id: "cap-6",
    event_type: "SIGNAL_RECEIVED",
    timestamp: hoursAgo(3.5),
    source_type: "twitter",
    source_name: "@inaborealchile",
    source_weight: SOURCE_TYPE_WEIGHTS.twitter,
    summary: "Vecinos de San Fabián reportan corte de suministro de agua potable",
    metadata: { batch_processed_at: hoursAgo(3) },
  },
];

// ─── Helpers ─────────────────────────────────────────────────────

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
   * Merges STATUS_CHANGE entries from need_audits with mock SIGNAL_RECEIVED entries.
   */
  async getLogForNeed(
    sectorId: string,
    capabilityId: string,
  ): Promise<CapabilityActivityLogEntry[]> {
    await simulateDelay(80);

    const mockEntries = MOCK_ACTIVITY_LOG
      .filter((e) => e.sector_id === sectorId && e.capability_id === capabilityId);

    const { data: auditRows, error: auditError } = await supabase
      .from("need_audits")
      .select("id, sector_id, capability_id, timestamp, previous_status, final_status, reasoning_summary, guardrails_applied")
      .eq("sector_id", sectorId)
      .eq("capability_id", capabilityId)
      .order("timestamp", { ascending: false })
      .limit(50);

    if (auditError) {
      console.error("[activityLogService] Failed to query need_audits:", auditError);
    }

    const statusChangeEntries: CapabilityActivityLogEntry[] = (auditRows ?? []).map(mapAuditRowToLogEntry);

    return [...mockEntries, ...statusChangeEntries]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  },

  /**
   * Get all activity log entries for a sector (across all capabilities).
   * Merges STATUS_CHANGE entries from need_audits with mock SIGNAL_RECEIVED entries.
   */
  async getLogForSector(sectorId: string): Promise<CapabilityActivityLogEntry[]> {
    await simulateDelay(80);

    const mockEntries = MOCK_ACTIVITY_LOG
      .filter((e) => e.sector_id === sectorId);

    const { data: auditRows, error: auditError } = await supabase
      .from("need_audits")
      .select("id, sector_id, capability_id, timestamp, previous_status, final_status, reasoning_summary, guardrails_applied")
      .eq("sector_id", sectorId)
      .order("timestamp", { ascending: false })
      .limit(50);

    if (auditError) {
      console.error("[activityLogService] Failed to query need_audits:", auditError);
    }

    const statusChangeEntries: CapabilityActivityLogEntry[] = (auditRows ?? []).map(mapAuditRowToLogEntry);

    return [...mockEntries, ...statusChangeEntries]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  },
};

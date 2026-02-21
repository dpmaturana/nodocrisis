import { supabase } from "@/integrations/supabase/client";
import type { DeploymentStatus, NeedLevel, Signal, SignalType } from "@/types/database";
import type { NeedStatus } from "@/lib/needStatus";

import type { ExtractedItem, ExtractedData } from "@/types/fieldReport";

/**
 * Shape returned by evaluateGapNeed — mirrors the NeedState interface from
 * the old NeedLevelEngine but populated from the evaluate-need endpoint
 * response so callers don't need to change.
 */
export interface NeedEvalResult {
  sector_id: string;
  capability_id: string;
  current_status: NeedStatus;
  demand_score: number;
  insufficiency_score: number;
  stabilization_score: number;
  fragility_score: number;
  coverage_score: number;
  stabilization_consecutive_windows: number;
  last_window_id: string | null;
  operational_requirements: string[];
  fragility_notes: string[];
  last_updated_at: string;
  last_status_change_at: string | null;
}

/**
 * Convert a field report extracted item's state/urgency into signal content
 * that the mapSignalType classifier will correctly categorize.
 */
export function fieldReportItemToSignalContent(item: ExtractedItem): string {
  switch (item.state) {
    case 'disponible':
      return `${item.name}: recurso disponible, operando estable`;
    case 'necesario':
      return `${item.name}: recurso necesario, no alcanza, insuficiente`;
    case 'en_camino':
      return `${item.name}: recurso en camino, despacho en ruta`;
    case 'agotado':
      return `${item.name}: recurso agotado, sin stock, saturado`;
    default:
      return `${item.name}: estado reportado`;
  }
}

/**
 * Map a field report item's urgency to a signal confidence value.
 * For stabilization (disponible), lower urgency means higher confidence
 * in stabilization. For other states, higher urgency = higher confidence
 * in the insufficiency/demand signal.
 */
export function fieldReportItemToConfidence(item: ExtractedItem): number {
  if (item.state === 'disponible') {
    switch (item.urgency) {
      case 'baja': return 1.0;
      case 'media': return 0.8;
      case 'alta': return 0.5;
      case 'crítica': return 0.3;
      default: return 0.6;
    }
  }
  switch (item.urgency) {
    case 'baja': return 0.3;
    case 'media': return 0.6;
    case 'alta': return 0.8;
    case 'crítica': return 1.0;
    default: return 0.5;
  }
}

/**
 * Map a NeedStatus from the engine back to a NeedLevel for sector_needs_context.
 */
export function mapNeedStatusToNeedLevel(status: NeedStatus): NeedLevel {
  switch (status) {
    case 'RED': return 'critical';
    case 'ORANGE': return 'high';
    case 'YELLOW': return 'medium';
    case 'GREEN': return 'low';
    case 'WHITE': return 'low';
    default: return 'medium';
  }
}

/**
 * Map a NeedLevel from sector_needs_context back to a NeedStatus for engine seeding.
 * Defaults to WHITE (monitoring) for any unrecognised value.
 */
export function mapNeedLevelToNeedStatus(level: NeedLevel): NeedStatus {
  switch (level) {
    case 'critical': return 'RED';
    case 'high': return 'ORANGE';
    case 'medium': return 'YELLOW';
    case 'low': return 'GREEN';
    default: return 'WHITE';
  }
}

/**
 * Map a Spanish field-report item state (from the ExtractedItem type) to the
 * English state string expected by the evaluate-need endpoint's signal format.
 */
function fieldItemStateToSignalState(state: string): string {
  switch (state) {
    case 'disponible': return 'available';
    case 'necesario':  return 'needed';
    case 'en_camino':  return 'in_transit';
    case 'agotado':    return 'depleted';
    default:           return 'needed';
  }
}

export const needSignalService = {
  /**
   * Call the evaluate-need backend endpoint with a set of signals and return
   * a NeedEvalResult for the sector/capability pair. The backend runs the
   * single-source-of-truth evaluation logic from _shared/evaluateNeedStatus.ts
   * and persists results to sector_needs_context + need_audits.
   */
  async evaluateGapNeed(params: {
    eventId: string;
    sectorId: string;
    capabilityId: string;
    signals: Array<{ state: string; confidence: number }>;
    nowIso?: string;
    previousStatus?: NeedStatus;
  }): Promise<NeedEvalResult | null> {
    try {
      const { data, error } = await supabase.functions.invoke('evaluate-need', {
        body: {
          event_id: params.eventId,
          sector_id: params.sectorId,
          capacity_type_id: params.capabilityId,
          signals: params.signals,
          previousStatus: params.previousStatus,
        },
      });

      if (error || !data) {
        console.error('[needSignalService] evaluate-need error:', error);
        return null;
      }

      const nowIso = params.nowIso ?? new Date().toISOString();
      return {
        sector_id: params.sectorId,
        capability_id: params.capabilityId,
        current_status: data.status as NeedStatus,
        demand_score: data.scores?.demand ?? 0,
        insufficiency_score: data.scores?.insuff ?? 0,
        stabilization_score: data.scores?.stab ?? 0,
        fragility_score: data.scores?.frag ?? 0,
        coverage_score: data.scores?.coverage ?? 0,
        stabilization_consecutive_windows: 0,
        last_window_id: null,
        operational_requirements: [],
        fragility_notes: [],
        last_updated_at: nowIso,
        last_status_change_at: null,
      };
    } catch (e) {
      console.error('[needSignalService] evaluateGapNeed exception:', e);
      return null;
    }
  },

  /**
   * Generate a synthetic signal when a deployment changes status so the
   * backend can re-evaluate the need for the affected sector/capability.
   */
  async onDeploymentStatusChange(params: {
    eventId: string;
    sectorId: string;
    capabilityId: string;
    deploymentStatus: DeploymentStatus;
    actorName?: string;
    nowIso?: string;
    previousStatus?: NeedStatus;
  }): Promise<NeedEvalResult | null> {
    let state: string;
    let confidence: number;

    switch (params.deploymentStatus) {
      case "interested":
        state = "in_transit";
        confidence = 0.5;
        break;
      case "operating":
        state = "in_transit";
        confidence = 0.9;
        break;
      case "confirmed":
        state = "in_transit";
        confidence = 0.7;
        break;
      case "suspended":
        state = "needed";
        confidence = 0.7;
        break;
      case "finished":
        state = "available";
        confidence = 0.9;
        break;
      default:
        return null;
    }

    return this.evaluateGapNeed({
      eventId: params.eventId,
      sectorId: params.sectorId,
      capabilityId: params.capabilityId,
      signals: [{ state, confidence }],
      nowIso: params.nowIso,
      previousStatus: params.previousStatus,
    });
  },

  /**
   * Process a completed field report by converting its extracted items into
   * signals and feeding them through the evaluate-need endpoint per capability.
   * Returns per-capability results with updated need levels.
   */
  async onFieldReportCompleted(params: {
    eventId: string;
    sectorId: string;
    extractedData: ExtractedData;
    capacityTypeMap: Record<string, string>; // capability name → capacity_type_id
    nowIso?: string;
    previousLevels?: Record<string, NeedStatus>; // capacity_type_id → current NeedStatus from DB
  }): Promise<Array<{ capabilityId: string; needLevel: NeedLevel; needState: NeedEvalResult | null }>> {
    const effectiveNow = params.nowIso ?? new Date().toISOString();
    const results: Array<{ capabilityId: string; needLevel: NeedLevel; needState: NeedEvalResult | null }> = [];

    // Group items by matching capability type
    const itemsByCapId = new Map<string, ExtractedItem[]>();
    for (const item of params.extractedData.items) {
      for (const [capName, capId] of Object.entries(params.capacityTypeMap)) {
        const capLower = capName.toLowerCase();
        const itemLower = item.name.toLowerCase();
        if (capLower.includes(itemLower) || itemLower.includes(capLower.split(' ')[0])) {
          if (!itemsByCapId.has(capId)) itemsByCapId.set(capId, []);
          itemsByCapId.get(capId)!.push(item);
        }
      }
    }

    // Also ensure capability_types from extracted data are included
    for (const capName of params.extractedData.capability_types) {
      const capId = params.capacityTypeMap[capName];
      if (capId && !itemsByCapId.has(capId)) {
        itemsByCapId.set(capId, []);
      }
    }

    // Process each capability type through the backend endpoint
    for (const [capId, items] of itemsByCapId) {
      const signals = items
        .map((item) => ({
          state: fieldItemStateToSignalState(item.state),
          confidence: fieldReportItemToConfidence(item),
        }))
        .filter((s) => s.confidence > 0);

      if (signals.length === 0) continue;

      const needState = await this.evaluateGapNeed({
        eventId: params.eventId,
        sectorId: params.sectorId,
        capabilityId: capId,
        signals,
        nowIso: effectiveNow,
        previousStatus: params.previousLevels?.[capId],
      });

      const needLevel = needState ? mapNeedStatusToNeedLevel(needState.current_status) : 'medium';
      results.push({ capabilityId: capId, needLevel, needState });
    }

    return results;
  },
};


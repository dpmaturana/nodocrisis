import {
  NeedLevelEngine,
  type ExtractorInput,
  type ExtractorOutput,
  type NeedAudit,
  type NeedEvaluatorInput,
  type NeedEvaluatorOutput,
  type NeedExtractionModel,
  type NeedEvaluatorModel,
  type NeedState,
  type NeedsRepository,
  type RawInput,
  type StructuredSignal,
} from "@/lib/needLevelEngine";
import type { DeploymentStatus, NeedLevel, Signal, SignalType } from "@/types/database";
import type { NeedStatus } from "@/lib/needStatus";
import type { ExtractedItem, ExtractedData } from "@/types/fieldReport";
import type { CapabilityActivityLogEntry } from "@/types/activityLog";
import { SOURCE_TYPE_WEIGHTS } from "@/types/activityLog";

class InMemoryNeedsRepository implements NeedsRepository {
  private rawInputs = new Map<string, RawInput>();
  private structuredSignals = new Map<string, StructuredSignal>();
  private needStates = new Map<string, NeedState>();
  private audits: NeedAudit[] = [];
  private activityLog: CapabilityActivityLogEntry[] = [];

  async findRawInputByHash(hash: string): Promise<RawInput | null> {
    return this.rawInputs.get(hash) ?? null;
  }

  async insertRawInput(raw: Omit<RawInput, "id">): Promise<RawInput> {
    const row: RawInput = { ...raw, id: `raw-${this.rawInputs.size + 1}` };
    this.rawInputs.set(raw.dedupe_hash, row);
    return row;
  }

  async insertStructuredSignal(signal: Omit<StructuredSignal, "id">): Promise<StructuredSignal> {
    const row: StructuredSignal = { ...signal, id: `structured-${this.structuredSignals.size + 1}` };
    this.structuredSignals.set(row.id, row);
    return row;
  }

  async listSignalsForNeed(params: { sector_id: string; capability_id: string; fromInclusive: string; toInclusive: string; }): Promise<StructuredSignal[]> {
    const from = new Date(params.fromInclusive).getTime();
    const to = new Date(params.toInclusive).getTime();

    return [...this.structuredSignals.values()].filter((signal) => {
      const signalTs = new Date(signal.timestamp).getTime();
      return (
        signal.sector_ref.sector_id === params.sector_id &&
        signal.capability_ref.capability_id === params.capability_id &&
        signalTs >= from &&
        signalTs <= to
      );
    });
  }

  async getNeedState(sector_id: string, capability_id: string): Promise<NeedState | null> {
    return this.needStates.get(`${sector_id}:${capability_id}`) ?? null;
  }

  async upsertNeedState(state: NeedState): Promise<void> {
    this.needStates.set(`${state.sector_id}:${state.capability_id}`, state);
  }

  async appendAudit(audit: NeedAudit): Promise<void> {
    this.audits.push(audit);
    if (audit.final_status !== audit.previous_status) {
      this.activityLog.push({
        id: crypto.randomUUID(),
        sector_id: audit.sector_id,
        capability_id: audit.capability_id,
        event_type: "STATUS_CHANGE",
        timestamp: audit.timestamp,
        source_type: "system",
        source_name: "Motor de decisión",
        source_weight: SOURCE_TYPE_WEIGHTS.system,
        summary: `Estado cambiado de ${audit.previous_status} a ${audit.final_status}`,
        reasoning_summary: audit.reasoning_summary,
        guardrails_applied: audit.guardrails_applied,
      });
    }
  }

  getLogForSector(sectorId: string): CapabilityActivityLogEntry[] {
    return this.activityLog
      .filter((e) => e.sector_id === sectorId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
}

class LegacySignalExtractor implements NeedExtractionModel {
  async extract(input: ExtractorInput): Promise<ExtractorOutput> {
    const payload = JSON.parse(input.raw.text) as {
      event_id: string;
      sector_id: string | null;
      capability_id: string | null;
      signal_type: SignalType;
      content: string;
      confidence: number;
      source: string;
      created_at: string;
    };

    const type = mapSignalType(payload.signal_type, payload.content);

    return {
      sector_ref: { sector_id: payload.sector_id, confidence: 1 },
      capability_ref: { capability_id: payload.capability_id, confidence: payload.confidence },
      source: {
        reliability:
          payload.signal_type === "official" || payload.signal_type === "actor_report"
            ? "Institutional"
            : payload.signal_type === "field_report"
            ? "NGO"
            : payload.signal_type === "context"
            ? "Original Context"
            : "Twitter",
      },
      timestamp: payload.created_at,
      classifications: [
        {
          type,
          confidence: payload.confidence,
          short_quote: payload.content.slice(0, 200),
          coverage_kind: /refuerzo|reinforcement|augment/i.test(payload.content) ? "augmentation" : "baseline",
        },
      ],
    };
  }
}

class RuleBasedNeedEvaluator implements NeedEvaluatorModel {
  async evaluate(input: NeedEvaluatorInput): Promise<NeedEvaluatorOutput> {
    const { demandStrong, insuffStrong, stabilizationStrong, fragilityAlert, coverageActive } = input.booleans;
    const allowed = input.allowed_transitions;

    let proposed_status = input.previous_status;

    if (demandStrong && !coverageActive) {
      proposed_status = "RED";
    } else if ((insuffStrong || demandStrong) && coverageActive) {
      proposed_status = "ORANGE";
    } else if (stabilizationStrong && !fragilityAlert && !demandStrong && !insuffStrong) {
      proposed_status = "GREEN";
    } else if (coverageActive) {
      proposed_status = "YELLOW";
    } else {
      proposed_status = "WHITE";
    }

    // Constrain to allowed transitions; fall back to previous status when illegal
    if (proposed_status !== input.previous_status && !allowed.includes(proposed_status)) {
      proposed_status = input.previous_status;
    }

    return {
      proposed_status,
      confidence: 0.8,
      reasoning_summary: "Rule-based evaluator proposal from weighted evidence.",
      contradiction_detected: demandStrong && stabilizationStrong,
      key_evidence: input.top_evidence.slice(0, 3).map((e) => e.raw_input_id),
      augmentation_commitment_detected: input.top_evidence.some((e) => e.coverage_kind === "augmentation"),
    };
  }
}

function mapSignalType(signalType: SignalType, content: string) {
  if (/fragil|riesgo|colapso|inestable/i.test(content)) {
    return "SIGNAL_FRAGILITY_ALERT" as const;
  }
  if (/no alcanza|insuficiente|saturado|sin/i.test(content)) {
    return "SIGNAL_INSUFFICIENCY" as const;
  }
  if (/operando|estable|normaliz|restablec/i.test(content)) {
    return "SIGNAL_STABILIZATION" as const;
  }
  if (/llega|despacho|en camino|refuerzo/i.test(content)) {
    return "SIGNAL_COVERAGE_ACTIVITY" as const;
  }
  if (signalType === "sms" || signalType === "social" || signalType === "news") {
    return "SIGNAL_DEMAND_INCREASE" as const;
  }
  return "SIGNAL_INSUFFICIENCY" as const;
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

const repository = new InMemoryNeedsRepository();
const extractor = new LegacySignalExtractor();
const evaluator = new RuleBasedNeedEvaluator();
const engine = new NeedLevelEngine(repository, extractor, evaluator);

export const needSignalService = {
  async evaluateGapNeed(params: {
    eventId: string;
    sectorId: string;
    capabilityId: string;
    signals: Signal[];
    nowIso?: string;
  }): Promise<NeedState | null> {
    const nowIso = params.nowIso ?? new Date().toISOString();

    for (const signal of params.signals) {
      await engine.processRawInput({
        source_type: signal.signal_type === "official" ? "institutional" : signal.signal_type === "field_report" ? "ngo" : signal.signal_type === "context" ? "original_context" : "twitter",
        source_name: signal.source,
        timestamp: signal.created_at,
        text: JSON.stringify({
          ...signal,
          capability_id: params.capabilityId,
          sector_id: params.sectorId,
          event_id: params.eventId,
        }),
        geo_hint: params.sectorId,
        nowIso,
      });
    }

    const state = await repository.getNeedState(params.sectorId, params.capabilityId);
    return state;
  },

  /**
   * Generate a synthetic signal when a deployment changes status so the
   * NeedLevelEngine can re-evaluate the need for the affected sector/capability.
   */
  async onDeploymentStatusChange(params: {
    eventId: string;
    sectorId: string;
    capabilityId: string;
    deploymentStatus: DeploymentStatus;
    actorName?: string;
    nowIso?: string;
  }): Promise<NeedState | null> {
    const effectiveNowIso = params.nowIso ?? new Date().toISOString();
    const actor = params.actorName ?? "actor";

    let content: string;
    let signalType: SignalType;

    switch (params.deploymentStatus) {
      case "operating":
        content = `Deployment ${actor} operating – coverage activity confirmed`;
        signalType = "actor_report";
        break;
      case "confirmed":
        content = `Deployment ${actor} confirmed – en camino`;
        signalType = "actor_report";
        break;
      case "suspended":
        content = `Deployment ${actor} suspended – riesgo de cobertura inestable`;
        signalType = "field_report";
        break;
      case "finished":
        content = `Deployment ${actor} finished – operando estable, normalización`;
        signalType = "actor_report";
        break;
      default:
        return repository.getNeedState(params.sectorId, params.capabilityId);
    }

    const signal: Signal = {
      id: `deploy-signal-${Date.now()}`,
      event_id: params.eventId,
      sector_id: params.sectorId,
      capacity_type_id: params.capabilityId,
      signal_type: signalType,
      level: "sector",
      content,
      source: `deployment:${actor}`,
      confidence: 0.9,
      created_at: effectiveNowIso,
    };

    return this.evaluateGapNeed({
      eventId: params.eventId,
      sectorId: params.sectorId,
      capabilityId: params.capabilityId,
      signals: [signal],
      nowIso: effectiveNowIso,
    });
  },

  /**
   * Process a completed field report by converting its extracted items into
   * signals and feeding them through the NeedLevelEngine. Returns per-capability
   * results with updated need levels.
   */
  async onFieldReportCompleted(params: {
    eventId: string;
    sectorId: string;
    extractedData: ExtractedData;
    capacityTypeMap: Record<string, string>; // capability name → capacity_type_id
    nowIso?: string;
  }): Promise<Array<{ capabilityId: string; needLevel: NeedLevel; needState: NeedState | null }>> {
    const effectiveNow = params.nowIso ?? new Date().toISOString();
    const results: Array<{ capabilityId: string; needLevel: NeedLevel; needState: NeedState | null }> = [];

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

    // Process each capability type through the engine
    for (const [capId, items] of itemsByCapId) {
      const batchTs = Date.now();
      const signals: Signal[] = items.map((item, i) => ({
        id: `field-report-signal-${batchTs}-${capId}-${i}`,
        event_id: params.eventId,
        sector_id: params.sectorId,
        capacity_type_id: capId,
        signal_type: 'field_report' as SignalType,
        level: 'sector' as const,
        content: fieldReportItemToSignalContent(item),
        source: 'field_report',
        confidence: fieldReportItemToConfidence(item),
        created_at: effectiveNow,
      }));

      if (signals.length === 0) continue;

      const needState = await this.evaluateGapNeed({
        eventId: params.eventId,
        sectorId: params.sectorId,
        capabilityId: capId,
        signals,
        nowIso: effectiveNow,
      });

      const needLevel = needState ? mapNeedStatusToNeedLevel(needState.current_status) : 'medium';
      results.push({ capabilityId: capId, needLevel, needState });
    }

    return results;
  },

  /**
   * Get activity log entries for a sector from the in-memory repository.
   */
  getLogForSector(sectorId: string): ReturnType<InMemoryNeedsRepository["getLogForSector"]> {
    return repository.getLogForSector(sectorId);
  },
};

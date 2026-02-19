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
import type { Signal, SignalType } from "@/types/database";

class InMemoryNeedsRepository implements NeedsRepository {
  private rawInputs = new Map<string, RawInput>();
  private structuredSignals = new Map<string, StructuredSignal>();
  private needStates = new Map<string, NeedState>();
  private audits: NeedAudit[] = [];

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

    let proposed_status = input.previous_status;

    if (demandStrong && !coverageActive) {
      proposed_status = "RED";
    } else if (insuffStrong && coverageActive) {
      proposed_status = "ORANGE";
    } else if (stabilizationStrong && !fragilityAlert && !demandStrong && !insuffStrong) {
      proposed_status = "GREEN";
    } else if (coverageActive) {
      proposed_status = "YELLOW";
    } else {
      proposed_status = "WHITE";
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
};

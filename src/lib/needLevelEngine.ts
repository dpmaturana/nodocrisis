import { NEED_STATUS_TRANSITIONS, type NeedStatus } from "@/lib/needStatus";

export type RawSourceType = "twitter" | "institutional" | "ngo" | "original_context";
export type SourceReliability = "Twitter" | "Institutional" | "NGO" | "Original Context";

export type ClassificationType =
  | "SIGNAL_DEMAND_INCREASE"
  | "SIGNAL_INSUFFICIENCY"
  | "SIGNAL_STABILIZATION"
  | "SIGNAL_FRAGILITY_ALERT"
  | "SIGNAL_COVERAGE_ACTIVITY"
  | "SIGNAL_BOTTLENECK";

export interface RawInput {
  id: string;
  source_type: RawSourceType;
  source_name: string;
  timestamp: string;
  text: string;
  dedupe_hash: string;
  geo_hint?: string | null;
}

export interface SignalClassification {
  type: ClassificationType;
  confidence: number;
  short_quote: string;
  note?: string;
  coverage_kind?: "augmentation" | "baseline";
}

export interface StructuredSignal {
  id: string;
  raw_input_id: string;
  sector_ref: { sector_id: string | null; confidence: number };
  capability_ref: { capability_id: string | null; confidence: number };
  classifications: SignalClassification[];
  source: { reliability: SourceReliability };
  timestamp: string;
  unresolved: boolean;
}

export interface NeedState {
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

export interface NeedEngineConfig {
  sourceWeights: Record<SourceReliability, number>;
  thresholds: {
    demandEscalation: number;
    insufficiencyEscalation: number;
    stabilizationDowngrade: number;
    stabilizationMinConsecutiveWindows: number;
    fragilityReactivation: number;
    coverageActivation: number;
  };
  minLlmConfidence: number;
  rollingWindowHours: number;
  consecutiveWindowMinutes: number;
  evaluatorModel: string;
  evaluatorPromptVersion: string;
}

export const defaultNeedEngineConfig: NeedEngineConfig = {
  sourceWeights: {
    Institutional: 1,
    NGO: 1,
    Twitter: 0.4,
    "Original Context": 1,
  },
  thresholds: {
    demandEscalation: 1,
    insufficiencyEscalation: 0.75,
    stabilizationDowngrade: 1.8,
    stabilizationMinConsecutiveWindows: 2,
    fragilityReactivation: 0.9,
    coverageActivation: 0.9,
  },
  minLlmConfidence: 0.65,
  rollingWindowHours: 24,
  consecutiveWindowMinutes: 60,
  evaluatorModel: "unset",
  evaluatorPromptVersion: "v1",
};

export interface EvaluatorEvidenceItem {
  raw_input_id: string;
  type: ClassificationType;
  delta: number;
  timestamp: string;
  reliability: SourceReliability;
  short_quote: string;
  note?: string;
  coverage_kind?: "augmentation" | "baseline";
}

export interface NeedEvaluatorInput {
  sector_id: string;
  capability_id: string;
  previous_status: NeedStatus;
  scores: Pick<
    NeedState,
    | "demand_score"
    | "insufficiency_score"
    | "stabilization_score"
    | "fragility_score"
    | "coverage_score"
    | "stabilization_consecutive_windows"
  >;
  booleans: {
    demandStrong: boolean;
    insuffStrong: boolean;
    stabilizationStrong: boolean;
    fragilityAlert: boolean;
    coverageActive: boolean;
  };
  window_id: string;
  top_evidence: EvaluatorEvidenceItem[];
  last_status_change_at: string | null;
  allowed_transitions: NeedStatus[];
  status_definitions: string;
  orange_to_yellow_rule: string;
}

export interface NeedEvaluatorOutput {
  proposed_status: NeedStatus;
  confidence: number;
  reasoning_summary: string;
  contradiction_detected: boolean;
  key_evidence: string[];
  augmentation_commitment_detected?: boolean;
}

export interface NeedAudit {
  id: string;
  sector_id: string;
  capability_id: string;
  timestamp: string;
  previous_status: NeedStatus;
  proposed_status: NeedStatus;
  final_status: NeedStatus;
  llm_confidence: number;
  reasoning_summary: string;
  contradiction_detected: boolean;
  key_evidence: string[];
  legal_transition: boolean;
  scores_snapshot: Pick<
    NeedState,
    | "demand_score"
    | "insufficiency_score"
    | "stabilization_score"
    | "fragility_score"
    | "coverage_score"
    | "stabilization_consecutive_windows"
  >;
  booleans_snapshot: {
    demandStrong: boolean;
    insuffStrong: boolean;
    stabilizationStrong: boolean;
    fragilityAlert: boolean;
    coverageActive: boolean;
  };
  model: string;
  prompt_version: string;
  config_snapshot: NeedEngineConfig;
  illegal_transition_reason?: string;
  guardrails_applied: string[];
}

export interface NeedsRepository {
  findRawInputByHash(hash: string): Promise<RawInput | null>;
  insertRawInput(raw: Omit<RawInput, "id">): Promise<RawInput>;
  insertStructuredSignal(signal: Omit<StructuredSignal, "id">): Promise<StructuredSignal>;
  listSignalsForNeed(params: {
    sector_id: string;
    capability_id: string;
    fromInclusive: string;
    toInclusive: string;
  }): Promise<StructuredSignal[]>;
  getNeedState(sector_id: string, capability_id: string): Promise<NeedState | null>;
  upsertNeedState(state: NeedState): Promise<void>;
  appendAudit(audit: NeedAudit): Promise<void>;
}

export interface ExtractorInput {
  raw: RawInput;
}

export interface ExtractorOutput {
  sector_ref: { sector_id: string | null; confidence: number };
  capability_ref: { capability_id: string | null; confidence: number };
  classifications: SignalClassification[];
  source: { reliability: SourceReliability };
  timestamp?: string;
}

export interface NeedExtractionModel {
  extract(input: ExtractorInput): Promise<ExtractorOutput>;
}

export interface NeedEvaluatorModel {
  evaluate(input: NeedEvaluatorInput): Promise<NeedEvaluatorOutput>;
}

export interface ProcessRawInputResult {
  deduped: boolean;
  raw_input: RawInput;
  structured_signal?: StructuredSignal;
  need_state?: NeedState;
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export function computeDedupeHash(input: {
  text: string;
  source_name: string;
  timestamp: string;
}): string {
  const payload = `${input.text}\n${input.source_name}\n${input.timestamp}`;
  let hash = 2166136261;
  for (let i = 0; i < payload.length; i += 1) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16)}`;
}

export function computeWindowId(timestamp: string, windowMinutes: number): string {
  const ms = new Date(timestamp).getTime();
  const windowMs = windowMinutes * 60 * 1000;
  const bucket = Math.floor(ms / windowMs);
  return `${bucket}`;
}

function evaluateBooleans(state: NeedState, cfg: NeedEngineConfig) {
  return {
    demandStrong: state.demand_score >= cfg.thresholds.demandEscalation,
    insuffStrong: state.insufficiency_score >= cfg.thresholds.insufficiencyEscalation,
    stabilizationStrong: state.stabilization_score >= cfg.thresholds.stabilizationDowngrade,
    fragilityAlert: state.fragility_score >= cfg.thresholds.fragilityReactivation,
    coverageActive: state.coverage_score >= cfg.thresholds.coverageActivation,
  };
}

function aggregateScores(
  signals: StructuredSignal[],
  cfg: NeedEngineConfig,
  nowIso: string,
): {
  demand_score: number;
  insufficiency_score: number;
  stabilization_score: number;
  fragility_score: number;
  coverage_score: number;
  stabilization_consecutive_windows: number;
  topEvidence: EvaluatorEvidenceItem[];
  fragilityNotes: string[];
  bottlenecks: string[];
  augmentationDetected: boolean;
  windowId: string;
} {
  const nowMs = new Date(nowIso).getTime();
  const fromMs = nowMs - cfg.rollingWindowHours * 60 * 60 * 1000;

  let demand = 0;
  let insuff = 0;
  let stab = 0;
  let frag = 0;
  let coverage = 0;
  let augmentationDetected = false;

  const stabilizationByWindow = new Map<string, number>();
  const evidence: EvaluatorEvidenceItem[] = [];
  const fragilityNotes: string[] = [];
  const bottlenecks: string[] = [];

  for (const signal of signals) {
    const signalMs = new Date(signal.timestamp).getTime();
    if (signalMs < fromMs || signalMs > nowMs) continue;

    const weight = cfg.sourceWeights[signal.source.reliability];
    const windowId = computeWindowId(signal.timestamp, cfg.consecutiveWindowMinutes);

    for (const c of signal.classifications) {
      const delta = clamp01(c.confidence) * weight;
      evidence.push({
        raw_input_id: signal.raw_input_id,
        type: c.type,
        delta,
        timestamp: signal.timestamp,
        reliability: signal.source.reliability,
        short_quote: c.short_quote,
        note: c.note,
        coverage_kind: c.coverage_kind,
      });

      switch (c.type) {
        case "SIGNAL_DEMAND_INCREASE":
          demand += delta;
          break;
        case "SIGNAL_INSUFFICIENCY":
          insuff += delta;
          break;
        case "SIGNAL_STABILIZATION": {
          stab += delta;
          stabilizationByWindow.set(windowId, (stabilizationByWindow.get(windowId) ?? 0) + delta);
          break;
        }
        case "SIGNAL_FRAGILITY_ALERT":
          frag += delta;
          if (c.note) fragilityNotes.push(c.note);
          break;
        case "SIGNAL_COVERAGE_ACTIVITY":
          coverage += delta;
          if (c.coverage_kind === "augmentation") augmentationDetected = true;
          break;
        case "SIGNAL_BOTTLENECK":
          if (c.note) bottlenecks.push(c.note);
          break;
      }
    }
  }

  const currentWindowId = computeWindowId(nowIso, cfg.consecutiveWindowMinutes);
  let consecutive = 0;
  let cursor = Number(currentWindowId);
  while (true) {
    const value = stabilizationByWindow.get(`${cursor}`) ?? 0;
    if (value >= cfg.thresholds.stabilizationDowngrade) {
      consecutive += 1;
      cursor -= 1;
      continue;
    }
    break;
  }

  const topEvidence = evidence.sort((a, b) => b.delta - a.delta).slice(0, 10);

  return {
    demand_score: demand,
    insufficiency_score: insuff,
    stabilization_score: stab,
    fragility_score: frag,
    coverage_score: coverage,
    stabilization_consecutive_windows: consecutive,
    topEvidence,
    fragilityNotes,
    bottlenecks,
    augmentationDetected,
    windowId: currentWindowId,
  };
}

function statusDefinitionsText() {
  return [
    "WHITE: monitoring/weak evidence, no strong situation identified.",
    "RED: demand increase strong and no active credible coverage.",
    "YELLOW: coverage active but outcomes not validated; uncertainty state.",
    "ORANGE: coverage active and insufficiency validated.",
    "GREEN: stabilization validated strongly and consistently, not blocked by fragility, and no dominant demand/insufficiency.",
    "Ordering of severity: RED > ORANGE > YELLOW > GREEN > WHITE.",
  ].join("\n");
}

export class NeedLevelEngine {
  constructor(
    private readonly repository: NeedsRepository,
    private readonly extractor: NeedExtractionModel,
    private readonly evaluator: NeedEvaluatorModel,
    private readonly config: NeedEngineConfig = defaultNeedEngineConfig,
  ) {}

  async processRawInput(input: {
    source_type: RawSourceType;
    source_name: string;
    timestamp: string;
    text: string;
    geo_hint?: string | null;
    nowIso?: string;
  }): Promise<ProcessRawInputResult> {
    const dedupe_hash = computeDedupeHash(input);
    const existing = await this.repository.findRawInputByHash(dedupe_hash);
    if (existing) {
      return { deduped: true, raw_input: existing };
    }

    const raw = await this.repository.insertRawInput({ ...input, dedupe_hash });
    const extracted = await this.extractor.extract({ raw });

    const structured = await this.repository.insertStructuredSignal({
      raw_input_id: raw.id,
      sector_ref: extracted.sector_ref,
      capability_ref: extracted.capability_ref,
      classifications: extracted.classifications,
      source: extracted.source,
      timestamp: extracted.timestamp ?? raw.timestamp,
      unresolved: !extracted.sector_ref.sector_id || !extracted.capability_ref.capability_id,
    });

    if (structured.unresolved) {
      return { deduped: false, raw_input: raw, structured_signal: structured };
    }

    const needState = await this.processStructuredSignal(structured, input.nowIso ?? input.timestamp);
    return { deduped: false, raw_input: raw, structured_signal: structured, need_state: needState };
  }

  async processStructuredSignal(signal: StructuredSignal, nowIso: string): Promise<NeedState | undefined> {
    const sector_id = signal.sector_ref.sector_id;
    const capability_id = signal.capability_ref.capability_id;
    if (!sector_id || !capability_id) return undefined;

    const fromInclusive = new Date(new Date(nowIso).getTime() - this.config.rollingWindowHours * 3600 * 1000).toISOString();

    const relevantSignals = await this.repository.listSignalsForNeed({
      sector_id,
      capability_id,
      fromInclusive,
      toInclusive: nowIso,
    });

    const previousState =
      (await this.repository.getNeedState(sector_id, capability_id)) ??
      {
        sector_id,
        capability_id,
        current_status: "WHITE" as NeedStatus,
        demand_score: 0,
        insufficiency_score: 0,
        stabilization_score: 0,
        fragility_score: 0,
        coverage_score: 0,
        stabilization_consecutive_windows: 0,
        last_window_id: null,
        operational_requirements: [],
        fragility_notes: [],
        last_updated_at: nowIso,
        last_status_change_at: null,
      };

    const agg = aggregateScores(relevantSignals, this.config, nowIso);

    const candidateState: NeedState = {
      ...previousState,
      demand_score: agg.demand_score,
      insufficiency_score: agg.insufficiency_score,
      stabilization_score: agg.stabilization_score,
      fragility_score: agg.fragility_score,
      coverage_score: agg.coverage_score,
      stabilization_consecutive_windows: agg.stabilization_consecutive_windows,
      last_window_id: agg.windowId,
      operational_requirements: [...previousState.operational_requirements, ...agg.bottlenecks],
      fragility_notes: [...previousState.fragility_notes, ...agg.fragilityNotes],
      last_updated_at: nowIso,
    };

    const booleans = evaluateBooleans(candidateState, this.config);
    const allowed = NEED_STATUS_TRANSITIONS[previousState.current_status];

    const llmResult = await this.evaluator.evaluate({
      sector_id,
      capability_id,
      previous_status: previousState.current_status,
      scores: {
        demand_score: candidateState.demand_score,
        insufficiency_score: candidateState.insufficiency_score,
        stabilization_score: candidateState.stabilization_score,
        fragility_score: candidateState.fragility_score,
        coverage_score: candidateState.coverage_score,
        stabilization_consecutive_windows: candidateState.stabilization_consecutive_windows,
      },
      booleans,
      window_id: agg.windowId,
      top_evidence: agg.topEvidence,
      last_status_change_at: previousState.last_status_change_at,
      allowed_transitions: allowed,
      status_definitions: statusDefinitionsText(),
      orange_to_yellow_rule:
        "ORANGE→YELLOW only when there is credible new augmentation commitment addressing insufficiency and outcomes are not yet validated.",
    });

    let legalTransition = llmResult.proposed_status === previousState.current_status || allowed.includes(llmResult.proposed_status);
    let proposal = legalTransition ? llmResult.proposed_status : previousState.current_status;
    const guardrails: string[] = [];
    let illegalTransitionReason: string | undefined;

    if (!legalTransition) {
      illegalTransitionReason = `Illegal transition ${previousState.current_status} -> ${llmResult.proposed_status}`;
      guardrails.push("transition_legality_block");
    }

    let finalStatus = proposal;
    let hardForced = false;

    // A) RED floor
    if (booleans.demandStrong && !booleans.coverageActive) {
      finalStatus = "RED";
      hardForced = true;
      guardrails.push("A_RED_floor");
    }

    // B) ORANGE eligibility / insufficiency w/o coverage => RED
    if (!hardForced && booleans.insuffStrong && !booleans.coverageActive) {
      finalStatus = "RED";
      hardForced = true;
      guardrails.push("B_insuff_without_coverage_to_RED");
    } else if (!hardForced && booleans.insuffStrong && booleans.coverageActive && finalStatus === "GREEN") {
      finalStatus = "ORANGE";
      guardrails.push("B_block_GREEN_when_insuff_and_coverage");
    }

    // C) GREEN eligibility
    if (!hardForced && finalStatus === "GREEN") {
      const greenEligible =
        booleans.stabilizationStrong &&
        candidateState.stabilization_consecutive_windows >= this.config.thresholds.stabilizationMinConsecutiveWindows &&
        !booleans.fragilityAlert &&
        !booleans.demandStrong &&
        !booleans.insuffStrong;
      if (!greenEligible) {
        finalStatus = "YELLOW";
        guardrails.push("C_GREEN_gate_block_to_YELLOW");
      }
    }

    // D) Fragility blocks GREEN
    if (!hardForced && booleans.fragilityAlert) {
      if (finalStatus === "GREEN") {
        finalStatus = "YELLOW";
        guardrails.push("D_fragility_block_GREEN");
      }
      if (previousState.current_status === "GREEN") {
        finalStatus = "YELLOW";
        guardrails.push("D_force_GREEN_to_YELLOW");
      }
    }

    // E) LLM confidence gate
    if (!hardForced && llmResult.confidence < this.config.minLlmConfidence) {
      finalStatus = previousState.current_status;
      guardrails.push("E_low_llm_confidence_keep_previous");
    }

    // F) ORANGE -> YELLOW special rule
    if (!hardForced && previousState.current_status === "ORANGE" && finalStatus === "YELLOW") {
      const augmentationDetected = agg.augmentationDetected || llmResult.augmentation_commitment_detected === true;
      const stabilizationDetected = candidateState.stabilization_score > 0;
      if (!augmentationDetected && !stabilizationDetected) {
        finalStatus = "ORANGE";
        guardrails.push("F_block_ORANGE_to_YELLOW_without_augmentation");
      } else {
        guardrails.push("F_allow_ORANGE_to_YELLOW_with_augmentation_or_stabilization");
      }
    }

    // G) Worsening escalation: when demand is strong and the status would
    //    remain at or below YELLOW (medium), escalate to ORANGE (high).
    //    This covers the scenario where an NGO (or any source) reports a
    //    worsening situation while coverage is technically active but demand
    //    is outpacing it.
    if (!hardForced && booleans.demandStrong && finalStatus !== "RED" && finalStatus !== "ORANGE") {
      finalStatus = "ORANGE";
      guardrails.push("G_escalate_to_ORANGE_on_demand");
    }

    const nextState: NeedState = {
      ...candidateState,
      current_status: finalStatus,
      last_status_change_at:
        finalStatus !== previousState.current_status
          ? nowIso
          : previousState.last_status_change_at,
    };

    await this.repository.upsertNeedState(nextState);

    await this.repository.appendAudit({
      id: crypto.randomUUID(),
      sector_id,
      capability_id,
      timestamp: nowIso,
      previous_status: previousState.current_status,
      proposed_status: llmResult.proposed_status,
      final_status: finalStatus,
      llm_confidence: llmResult.confidence,
      reasoning_summary: llmResult.reasoning_summary,
      contradiction_detected: llmResult.contradiction_detected,
      key_evidence: llmResult.key_evidence,
      legal_transition: legalTransition,
      scores_snapshot: {
        demand_score: nextState.demand_score,
        insufficiency_score: nextState.insufficiency_score,
        stabilization_score: nextState.stabilization_score,
        fragility_score: nextState.fragility_score,
        coverage_score: nextState.coverage_score,
        stabilization_consecutive_windows: nextState.stabilization_consecutive_windows,
      },
      booleans_snapshot: booleans,
      model: this.config.evaluatorModel,
      prompt_version: this.config.evaluatorPromptVersion,
      config_snapshot: this.config,
      illegal_transition_reason: illegalTransitionReason,
      guardrails_applied: guardrails,
    });

    return nextState;
  }
}

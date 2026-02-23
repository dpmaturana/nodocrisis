/**
 * evaluateNeedStatus — shared pure evaluation logic.
 *
 * This module is the single source of truth for need-status evaluation.
 * It is imported by all edge functions that need to evaluate need levels,
 * and can also be imported directly by Vitest (Node.js) tests since it
 * contains no Deno-specific or Node-specific APIs.
 */

export type NeedStatus = "WHITE" | "RED" | "YELLOW" | "ORANGE" | "GREEN";
export type NeedLevel = "low" | "medium" | "high" | "critical";
export type SignalClassification =
  | "INSUFFICIENCY"
  | "STABILIZATION"
  | "COVERAGE_ACTIVITY"
  | "FRAGILITY_ALERT"
  | "DEMAND";

export interface EvaluationResult {
  status: NeedStatus;
  scores: { demand: number; insuff: number; stab: number; frag: number; coverage: number };
  booleans: {
    demandStrong: boolean;
    insuffStrong: boolean;
    stabilizationStrong: boolean;
    fragilityAlert: boolean;
    coverageActive: boolean;
    coverageIntent: boolean;
  };
  guardrailsApplied: string[];
  legalTransition: boolean;
}

/**
 * Legal status transitions — mirrors NEED_STATUS_TRANSITIONS in src/lib/needStatus.ts.
 * A transition from A → B is legal if B appears in NEED_STATUS_TRANSITIONS[A].
 * Staying in the same status is always legal.
 */
export const NEED_STATUS_TRANSITIONS: Record<NeedStatus, NeedStatus[]> = {
  WHITE:  ["RED", "YELLOW", "ORANGE"],
  RED:    ["YELLOW", "ORANGE"],
  YELLOW: ["ORANGE", "GREEN", "RED", "WHITE"],
  ORANGE: ["GREEN", "RED", "YELLOW"],
  GREEN:  ["YELLOW", "ORANGE", "RED"],
};

/** Check whether a status transition is legal. Same status is always valid. */
export function isValidNeedTransition(from: NeedStatus, to: NeedStatus): boolean {
  if (from === to) return true;
  return NEED_STATUS_TRANSITIONS[from].includes(to);
}

/** Severity ranking: higher number = more severe. */
const STATUS_SEVERITY: Record<NeedStatus, number> = {
  WHITE: 0, GREEN: 1, YELLOW: 2, ORANGE: 3, RED: 4,
};

const SEVERITY_ORDER: NeedStatus[] = ["WHITE", "GREEN", "YELLOW", "ORANGE", "RED"];

/**
 * When a proposed transition is illegal, walk the severity ladder one step at a
 * time in the intended direction and return the first legal intermediate status.
 * Falls back to `from` (no change) if no legal intermediate is found.
 */
export function clampToNearestLegalStep(from: NeedStatus, proposed: NeedStatus): NeedStatus {
  if (isValidNeedTransition(from, proposed)) return proposed;

  const fromSev = STATUS_SEVERITY[from];
  const proposedSev = STATUS_SEVERITY[proposed];

  if (proposedSev < fromSev) {
    // Improvement: walk from proposed upward toward from
    for (let i = proposedSev + 1; i < fromSev; i++) {
      const candidate = SEVERITY_ORDER[i];
      if (isValidNeedTransition(from, candidate)) return candidate;
    }
  } else {
    // Worsening: walk from proposed downward toward from
    for (let i = proposedSev - 1; i > fromSev; i--) {
      const candidate = SEVERITY_ORDER[i];
      if (isValidNeedTransition(from, candidate)) return candidate;
    }
  }

  return from; // safe fallback
}

// Source weight for field-report signals (NGO tier, same as defaultNeedEngineConfig)
export const SOURCE_WEIGHT = 1.0;

// Thresholds — mirrors defaultNeedEngineConfig in needLevelEngine.ts
export const THRESHOLDS = {
  demandEscalation: 1,
  insufficiencyEscalation: 0.75,
  stabilizationDowngrade: 0.7,
  fragilityReactivation: 0.9,
  coverageActivation: 0.9,
  coverageIntent: 0.4,
};

/** Map a DB need level back to a NeedStatus string for audit records */
export function mapNeedLevelToAuditStatus(level: string): NeedStatus {
  switch (level) {
    case "critical": return "RED";
    case "high":     return "ORANGE";
    case "medium":   return "YELLOW";
    case "low":      return "GREEN";
    default:         return "WHITE";
  }
}

/**
 * Classify an extracted item state into a signal classification.
 * The LLM extraction prompt guarantees English-only output for edge-function
 * paths; "fragility" is a synthetic state used internally.
 */
export function classifyItemState(state: string): SignalClassification {
  switch (state) {
    case "demand":     return "DEMAND";    // used by tweet aggregation for SIGNAL_DEMAND_INCREASE
    case "needed":     return "INSUFFICIENCY";
    case "depleted":   return "INSUFFICIENCY";
    case "available":  return "STABILIZATION";
    case "in_transit": return "COVERAGE_ACTIVITY";
    case "fragility":  return "FRAGILITY_ALERT";
    default:           return "INSUFFICIENCY"; // safe escalation fallback
  }
}

/**
 * Aggregate signals and apply the rule-based guardrails to produce a
 * NeedStatus recommendation.
 *
 * This is the canonical implementation — both edge functions and the
 * frontend service use this function to guarantee identical results.
 */
export function evaluateNeedStatus(
  signals: Array<{ state: string; confidence: number }>,
  previousStatus?: NeedStatus,
): EvaluationResult {
  let demand = 0, insuff = 0, stab = 0, frag = 0, coverage = 0;

  for (const sig of signals) {
    const delta = sig.confidence * SOURCE_WEIGHT;
    switch (classifyItemState(sig.state)) {
      case "INSUFFICIENCY":     insuff += delta;   break;
      case "STABILIZATION":     stab += delta;     break;
      case "FRAGILITY_ALERT":   frag += delta;     break;
      case "COVERAGE_ACTIVITY": coverage += delta; break;
      default:                  demand += delta;   break;
    }
  }

  const scores = { demand, insuff, stab, frag, coverage };

  const demandStrong        = demand   >= THRESHOLDS.demandEscalation;
  const insuffStrong        = insuff   >= THRESHOLDS.insufficiencyEscalation;
  const stabilizationStrong = stab    >= THRESHOLDS.stabilizationDowngrade;
  const fragilityAlert      = frag    >= THRESHOLDS.fragilityReactivation;
  const coverageActive      = coverage >= THRESHOLDS.coverageActivation;
  const coverageIntent      = coverage >= THRESHOLDS.coverageIntent;

  const booleans = {
    demandStrong,
    insuffStrong,
    stabilizationStrong,
    fragilityAlert,
    coverageActive,
    coverageIntent,
  };
  const guardrailsApplied: string[] = [];

  // Base rule evaluation (RuleBasedNeedEvaluator)
  let proposed: NeedStatus = "WHITE";
  if (demandStrong && !coverageActive) {
    proposed = "RED";
  } else if ((insuffStrong || demandStrong) && coverageActive) {
    proposed = "ORANGE";
  } else if (stabilizationStrong && !fragilityAlert && !demandStrong && !insuffStrong) {
    proposed = "GREEN";
  } else if (coverageActive || (coverageIntent && !demandStrong && !insuffStrong)) {
    proposed = "YELLOW";
  }

  // Guardrail A: RED floor when demand is strong and no coverage
  if (demandStrong && !coverageActive) {
    proposed = "RED";
    guardrailsApplied.push("Guardrail A");
  }

  // Guardrail B: insufficiency without coverage → RED
  if (insuffStrong && !coverageActive && proposed !== "RED") {
    proposed = "RED";
    guardrailsApplied.push("Guardrail B");
  }

  // Guardrail G: worsening escalation — demand strong requires at least ORANGE
  if (proposed !== "RED" && proposed !== "ORANGE" && demandStrong) {
    proposed = "ORANGE";
    guardrailsApplied.push("Guardrail G");
  }

  // Guardrail C: GREEN eligibility gate — all conditions must be met to reach GREEN
  const meetsGreenEligibility = stabilizationStrong && !fragilityAlert && !demandStrong && !insuffStrong;
  if (proposed === "GREEN" && !meetsGreenEligibility) {
    proposed = "YELLOW";
    guardrailsApplied.push("Guardrail C");
  }

  // Guardrail D: fragility alert blocks GREEN and ensures minimum YELLOW
  if (fragilityAlert) {
    if (proposed === "GREEN" || proposed === "WHITE") {
      // Fragility signals present: cannot stay at baseline or reach stabilized status
      proposed = "YELLOW";
      guardrailsApplied.push("Guardrail D");
    }
  }

  // Transition legality validation
  const legalTransition = previousStatus === undefined || previousStatus === null
    ? true
    : isValidNeedTransition(previousStatus, proposed);

  return { status: proposed, scores, booleans, guardrailsApplied, legalTransition };
}

export function buildHumanReasoning(
  scores: { demand: number; insuff: number; stab: number; frag: number; coverage: number },
  booleans: {
    demandStrong: boolean;
    insuffStrong: boolean;
    stabilizationStrong: boolean;
    fragilityAlert: boolean;
    coverageActive: boolean;
    coverageIntent: boolean;
  },
  status: NeedStatus,
  guardrails: string[],
): string {
  const STATUS_LABELS: Record<string, string> = {
    RED: "Critical",
    ORANGE: "Insufficient coverage",
    YELLOW: "Validating",
    GREEN: "Stabilized",
    WHITE: "Monitoring",
  };
  let sentence: string;
  switch (status) {
    case "RED":    sentence = "High insufficiency detected with no active coverage."; break;
    case "ORANGE": sentence = "Demand or insufficiency signals present but coverage is active."; break;
    case "YELLOW": sentence = "Coverage activity detected, pending validation."; break;
    case "GREEN":  sentence = "Stabilization signals strong with no alerts."; break;
    default:       sentence = "No significant signals detected."; break;
  }
  sentence += ` Status set to ${STATUS_LABELS[status] ?? status}.`;

  const GUARDRAIL_EXPLANATIONS: Record<string, string> = {
    "Guardrail A": "demand is strong with no coverage, floor set to Critical",
    "Guardrail B": "insufficiency is strong with no coverage, escalated to Critical",
    "Guardrail G": "demand signals require at least Insufficient coverage status",
    "Guardrail C": "GREEN eligibility conditions not fully met, demoted to Validating",
    "Guardrail D": "fragility alert detected, GREEN transition blocked or forced down to Validating",
  };
  for (const g of guardrails) {
    const explanation = GUARDRAIL_EXPLANATIONS[g]
      ?? (g.startsWith("transition_clamped_to_")
        ? `transition not legal; stepped to nearest legal status: ${g.replace("transition_clamped_to_", "")}`
        : undefined);
    if (explanation) sentence += ` Safety rule: ${explanation}.`;
  }
  return sentence;
}

/** Map a NeedStatus to the DB NeedLevel representation */
export function mapNeedStatusToNeedLevel(status: NeedStatus): NeedLevel {
  switch (status) {
    case "RED":    return "critical";
    case "ORANGE": return "high";
    case "YELLOW": return "medium";
    case "GREEN":  return "low";
    case "WHITE":  return "low";
    default:       return "medium";
  }
}

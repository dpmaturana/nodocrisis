/**
 * evaluateNeedStatusWithLLM — LLM-driven need status evaluation.
 *
 * Restores the full NeedLevelEngine flow from src/lib/needLevelEngine.ts:
 *   1. Aggregate signals across 5 dimensions (demand, insufficiency,
 *      stabilization, fragility, coverage)
 *   2. Call an LLM evaluator with full context (scores, booleans, evidence,
 *      allowed transitions, status definitions)
 *   3. Apply guardrails A-G on top of the LLM proposal to enforce safety rules
 *   4. Log reasoning with LLM confidence, key evidence, and audit trail
 *
 * This module is Deno-compatible (no @/ imports) for use in edge functions.
 */

import {
  type NeedStatus,
  type EvaluationResult,
  NEED_STATUS_TRANSITIONS,
  THRESHOLDS,
  SOURCE_WEIGHT,
  classifyItemState,
  isValidNeedTransition,
  buildHumanReasoning,
} from "./evaluateNeedStatus.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Output from the LLM evaluator call. */
export interface LLMEvaluatorOutput {
  proposed_status: NeedStatus;
  confidence: number;
  reasoning_summary: string;
  contradiction_detected: boolean;
  key_evidence: string[];
}

/** Extended result that includes LLM metadata alongside the standard EvaluationResult. */
export interface LLMEvaluationResult extends EvaluationResult {
  /** Confidence reported by the LLM (0 when rule-based fallback was used). */
  llm_confidence: number;
  /** Reasoning text — LLM's own summary when used, human-readable rule text otherwise. */
  reasoning_summary: string;
  contradiction_detected: boolean;
  key_evidence: string[];
  /** "llm-engine" when LLM was consulted; "rule-based-engine" on fallback. */
  model: string;
  llm_used: boolean;
  /** Reason the LLM was skipped or failed; undefined when LLM succeeded. */
  llm_error?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum LLM confidence below which Guardrail E keeps the previous status. */
const MIN_LLM_CONFIDENCE = 0.65;

const VALID_STATUSES: NeedStatus[] = ["WHITE", "RED", "YELLOW", "ORANGE", "GREEN"];

// ---------------------------------------------------------------------------
// Status definitions (mirrors statusDefinitionsText in original NeedLevelEngine)
// ---------------------------------------------------------------------------

function statusDefinitionsText(): string {
  return [
    "WHITE: monitoring/weak evidence, no strong situation identified.",
    "RED: demand increase strong and no active credible coverage.",
    "YELLOW: coverage active but outcomes not validated; uncertainty state.",
    "ORANGE: coverage active and insufficiency validated.",
    "GREEN: stabilization validated strongly and consistently, not blocked by fragility, and no dominant demand/insufficiency.",
    "Ordering of severity: RED > ORANGE > YELLOW > GREEN > WHITE.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// LLM evaluator call
// ---------------------------------------------------------------------------

async function callLLMEvaluator(
  input: {
    previous_status: NeedStatus;
    scores: { demand: number; insuff: number; stab: number; frag: number; coverage: number };
    booleans: {
      demandStrong: boolean;
      insuffStrong: boolean;
      stabilizationStrong: boolean;
      fragilityAlert: boolean;
      coverageActive: boolean;
      coverageIntent: boolean;
    };
    allowed_transitions: NeedStatus[];
    evidence_quotes: string[];
    observations: string | null;
  },
  lovableApiKey: string,
): Promise<LLMEvaluatorOutput | null> {
  const systemPrompt = `You are a humanitarian crisis need-level evaluator.
Given dimensional scores, boolean flags, evidence quotes, and the set of allowed status transitions, propose the most appropriate need status.
Return ONLY valid JSON — no markdown, no explanation outside the JSON.

Status definitions:
${statusDefinitionsText()}

ORANGE→YELLOW transition rule: only when there is credible new augmentation commitment addressing insufficiency and outcomes are not yet validated.

Response format:
{
  "proposed_status": "WHITE"|"RED"|"YELLOW"|"ORANGE"|"GREEN",
  "confidence": <0.0-1.0>,
  "reasoning_summary": "<one-sentence explanation>",
  "contradiction_detected": <true|false>,
  "key_evidence": ["<quote1>", "<quote2>"]
}`;

  const userContent = JSON.stringify({
    previous_status: input.previous_status,
    scores: input.scores,
    booleans: input.booleans,
    allowed_transitions: input.allowed_transitions,
    evidence_quotes: input.evidence_quotes,
    observations: input.observations,
  });

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        temperature: 0.1,
        max_tokens: 400,
      }),
    });

    if (!response.ok) {
      console.warn(`[NeedLevelEngine] LLM evaluator HTTP error: ${response.status}`);
      return null;
    }

    const result = await response.json();
    const content: string = result.choices?.[0]?.message?.content ?? "";

    let jsonStr = content;
    if (jsonStr.includes("```")) {
      jsonStr = jsonStr.replace(/```json?\n?/g, "").replace(/```/g, "");
    }

    const parsed = JSON.parse(jsonStr.trim());
    const proposedStatus = parsed.proposed_status as NeedStatus;

    if (!VALID_STATUSES.includes(proposedStatus)) {
      console.warn(`[NeedLevelEngine] LLM proposed invalid status: ${String(proposedStatus)}`);
      return null;
    }

    return {
      proposed_status: proposedStatus,
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence ?? 0.0))),
      reasoning_summary: String(parsed.reasoning_summary ?? ""),
      contradiction_detected: Boolean(parsed.contradiction_detected ?? false),
      key_evidence: Array.isArray(parsed.key_evidence)
        ? (parsed.key_evidence as unknown[]).map(String)
        : [],
    };
  } catch (err) {
    console.warn("[NeedLevelEngine] LLM evaluator error:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main exported function
// ---------------------------------------------------------------------------

/**
 * Evaluate need status using the LLM as core evaluator with guardrails A-G.
 *
 * Flow (mirrors original NeedLevelEngine.processStructuredSignal):
 *   1. Aggregate signals into 5 dimensional scores
 *   2. Compute boolean flags from scores
 *   3. Call LLM with full context → get proposed status + confidence
 *   4. Apply guardrails A-G to enforce safety rules
 *   5. Return final status with llm_confidence and model tag
 *
 * Falls back to rule-based evaluation if LOVABLE_API_KEY is not provided or
 * the LLM call fails.
 */
export async function evaluateNeedStatusWithLLM(
  signals: Array<{ state: string; confidence: number }>,
  previousStatus: NeedStatus | undefined,
  context: {
    lovableApiKey?: string;
    evidenceQuotes?: string[];
    observations?: string | null;
  } = {},
): Promise<LLMEvaluationResult> {
  // 1. Score aggregation — identical to evaluateNeedStatus
  let demand = 0, insuff = 0, stab = 0, frag = 0, coverage = 0;
  for (const sig of signals) {
    const delta = sig.confidence * SOURCE_WEIGHT;
    switch (classifyItemState(sig.state)) {
      case "INSUFFICIENCY":     insuff   += delta; break;
      case "STABILIZATION":     stab     += delta; break;
      case "FRAGILITY_ALERT":   frag     += delta; break;
      case "COVERAGE_ACTIVITY": coverage += delta; break;
      default:                  demand   += delta; break;
    }
  }

  const scores = { demand, insuff, stab, frag, coverage };

  // 2. Boolean flags (mirrors evaluateBooleans from original NeedLevelEngine)
  const demandStrong        = demand   >= THRESHOLDS.demandEscalation;
  const insuffStrong        = insuff   >= THRESHOLDS.insufficiencyEscalation;
  const stabilizationStrong = stab     >= THRESHOLDS.stabilizationDowngrade;
  const fragilityAlert      = frag     >= THRESHOLDS.fragilityReactivation;
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

  const prevStatus: NeedStatus = previousStatus ?? "WHITE";
  const allowedTransitions = NEED_STATUS_TRANSITIONS[prevStatus];
  const guardrailsApplied: string[] = [];

  // 3. Call LLM with full context
  let llmResult: LLMEvaluatorOutput | null = null;
  let llmUsed = false;
  let llmError: string | undefined;

  console.log(`[NeedLevelEngine] lovableApiKey available: ${Boolean(context.lovableApiKey)}`);

  if (context.lovableApiKey) {
    console.log("[NeedLevelEngine] Attempting LLM evaluator call...");
    llmResult = await callLLMEvaluator(
      {
        previous_status: prevStatus,
        scores,
        booleans,
        allowed_transitions: allowedTransitions,
        evidence_quotes: context.evidenceQuotes ?? [],
        observations: context.observations ?? null,
      },
      context.lovableApiKey,
    );
    if (llmResult) {
      console.log(`[NeedLevelEngine] LLM evaluator succeeded: proposed_status=${llmResult.proposed_status} confidence=${llmResult.confidence}`);
    } else {
      console.warn("[NeedLevelEngine] LLM evaluator returned null (call failed or returned invalid response)");
      llmError = "llm_call_failed";
    }
  } else {
    llmError = "no_api_key";
  }

  // 4a. Determine initial proposal
  let proposal: NeedStatus;
  let legalTransition: boolean;

  if (llmResult) {
    llmUsed = true;
    legalTransition = isValidNeedTransition(prevStatus, llmResult.proposed_status);
    proposal = legalTransition ? llmResult.proposed_status : prevStatus;
    if (!legalTransition) {
      guardrailsApplied.push("transition_legality_block");
    }
  } else {
    // Rule-based fallback (same base logic as evaluateNeedStatus)
    proposal = "WHITE";
    if (demandStrong && !coverageActive) {
      proposal = "RED";
    } else if ((insuffStrong || demandStrong) && coverageActive) {
      proposal = "ORANGE";
    } else if (stabilizationStrong && !fragilityAlert && !demandStrong && !insuffStrong) {
      proposal = "GREEN";
    } else if (coverageActive || (coverageIntent && !demandStrong && !insuffStrong)) {
      proposal = "YELLOW";
    }
    legalTransition = previousStatus === undefined
      ? true
      : isValidNeedTransition(prevStatus, proposal);
    if (!legalTransition && previousStatus !== undefined) {
      console.log(`[NeedLevelEngine] Rule-based illegal transition ${prevStatus}->${proposal}, clamping to ${prevStatus}`);
      proposal = prevStatus;
      legalTransition = true;
      guardrailsApplied.push("transition_clamping");
    }
  }

  let finalStatus = proposal;
  let hardForced = false;

  // 4b. Guardrails A-G (mirrors processStructuredSignal from original NeedLevelEngine)

  // Guardrail A: RED floor — demand strong + no coverage
  if (booleans.demandStrong && !booleans.coverageActive) {
    finalStatus = "RED";
    hardForced = true;
    guardrailsApplied.push("Guardrail A");
  }

  // Guardrail B: insufficiency without coverage → RED;
  //             insufficiency + coverage blocks GREEN → ORANGE
  if (!hardForced && booleans.insuffStrong && !booleans.coverageActive) {
    finalStatus = "RED";
    hardForced = true;
    guardrailsApplied.push("Guardrail B");
  } else if (!hardForced && booleans.insuffStrong && booleans.coverageActive && finalStatus === "GREEN") {
    finalStatus = "ORANGE";
    guardrailsApplied.push("Guardrail B");
  }

  // Guardrail C: GREEN eligibility gate
  if (!hardForced && finalStatus === "GREEN") {
    const meetsGreenEligibility =
      booleans.stabilizationStrong &&
      !booleans.fragilityAlert &&
      !booleans.demandStrong &&
      !booleans.insuffStrong;
    if (!meetsGreenEligibility) {
      finalStatus = "YELLOW";
      guardrailsApplied.push("Guardrail C");
    }
  }

  // Guardrail D: fragility blocks GREEN; fragility on WHITE escalates to YELLOW
  if (!hardForced && booleans.fragilityAlert) {
    if (finalStatus === "GREEN" || finalStatus === "WHITE") {
      finalStatus = "YELLOW";
      guardrailsApplied.push("Guardrail D");
    }
    if (prevStatus === "GREEN" && finalStatus !== "YELLOW") {
      finalStatus = "YELLOW";
      guardrailsApplied.push("Guardrail D");
    }
  }

  // Guardrail E: LLM confidence gate — if confidence is too low, keep previous status
  if (!hardForced && llmUsed && llmResult && llmResult.confidence < MIN_LLM_CONFIDENCE) {
    finalStatus = prevStatus;
    guardrailsApplied.push("Guardrail E");
  }

  // Guardrail F: ORANGE→YELLOW requires stabilization evidence
  if (
    !hardForced &&
    prevStatus === "ORANGE" &&
    finalStatus === "YELLOW"
  ) {
    const hasStabilizationSignal = scores.stab > 0;
    if (!hasStabilizationSignal) {
      finalStatus = "ORANGE";
      guardrailsApplied.push("Guardrail F");
    }
  }

  // Guardrail G: worsening escalation — demand strong requires at least ORANGE
  if (!hardForced && booleans.demandStrong && finalStatus !== "RED" && finalStatus !== "ORANGE") {
    finalStatus = "ORANGE";
    guardrailsApplied.push("Guardrail G");
  }

  // Recalculate legal transition with the final guardrail-enforced status
  legalTransition = previousStatus === undefined
    ? true
    : isValidNeedTransition(prevStatus, finalStatus);

  // Build reasoning: use LLM's own summary when available, otherwise rule-based text.
  // When guardrails override the LLM proposal, append a human-readable explanation
  // so the audit log clearly explains why the status was kept or changed.
  const GUARDRAIL_EXPLANATIONS: Record<string, string> = {
    "Guardrail A": "demand is strong with no coverage, floor set to Critical",
    "Guardrail B": "insufficiency is strong with no coverage, escalated to Critical",
    "Guardrail C": "GREEN eligibility conditions not fully met, demoted to Validating",
    "Guardrail D": "fragility alert detected, GREEN transition blocked",
    "Guardrail E": "LLM confidence too low, status kept unchanged",
    "Guardrail F": "ORANGE→YELLOW requires stabilization evidence, reverted to Insufficient coverage",
    "Guardrail G": "demand signals require at least Insufficient coverage status",
    "transition_legality_block": "transition not allowed by state machine rules",
    "transition_clamping": "transition not allowed by state machine rules",
  };

  let reasoningSummary: string;
  if (llmUsed && llmResult) {
    if (guardrailsApplied.length > 0) {
      const explanations = guardrailsApplied
        .map(g => GUARDRAIL_EXPLANATIONS[g] ?? g)
        .join("; ");
      const STATUS_LABELS: Record<string, string> = {
        RED: "Critical", ORANGE: "Insufficient coverage", YELLOW: "Validating",
        GREEN: "Stabilized", WHITE: "Monitoring",
      };
      const finalLabel = STATUS_LABELS[finalStatus] ?? finalStatus;
      if (finalStatus === prevStatus && llmResult.proposed_status !== finalStatus) {
        reasoningSummary = `${llmResult.reasoning_summary}. However, safety rules prevented this change (${explanations}). Status remains ${finalLabel}.`;
      } else {
        reasoningSummary = `${llmResult.reasoning_summary}. Safety rules applied: ${explanations}. Status set to ${finalLabel}.`;
      }
    } else {
      reasoningSummary = llmResult.reasoning_summary;
    }
  } else {
    reasoningSummary = buildHumanReasoning(scores, booleans, finalStatus, guardrailsApplied);
  }

  return {
    status: finalStatus,
    scores,
    booleans,
    guardrailsApplied,
    legalTransition,
    llm_confidence: llmResult?.confidence ?? 0,
    reasoning_summary: reasoningSummary,
    contradiction_detected: llmResult?.contradiction_detected ?? false,
    key_evidence: llmResult?.key_evidence ?? [],
    model: llmUsed ? "llm-engine" : "rule-based-engine",
    llm_used: llmUsed,
    llm_error: llmError,
  };
}

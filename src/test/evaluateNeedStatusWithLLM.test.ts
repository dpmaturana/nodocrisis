import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { evaluateNeedStatusWithLLM } from "../../supabase/functions/_shared/evaluateNeedStatusWithLLM";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLLMResponse(body: object) {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content: JSON.stringify(body) } }],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

// ---------------------------------------------------------------------------
// evaluateNeedStatusWithLLM — reasoning_summary when guardrails override LLM
// ---------------------------------------------------------------------------

describe("evaluateNeedStatusWithLLM — reasoning_summary guardrail override", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps LLM reasoning unchanged when no guardrails fire", async () => {
    // Signals that produce stabilizationStrong=true and nothing else → GREEN is valid
    // LLM proposes GREEN with high confidence; previous status WHITE→GREEN is illegal
    // but we test the reasoning content, not legality.  Use previousStatus=YELLOW so GREEN is legal.
    vi.mocked(fetch).mockResolvedValueOnce(
      makeLLMResponse({
        proposed_status: "GREEN",
        confidence: 0.9,
        reasoning_summary: "Stabilization is strongly validated.",
        contradiction_detected: false,
        key_evidence: [],
      }),
    );

    const result = await evaluateNeedStatusWithLLM(
      [{ state: "available", confidence: 0.8 }],
      "YELLOW",
      { lovableApiKey: "test-key" },
    );

    expect(result.llm_used).toBe(true);
    expect(result.guardrailsApplied).toHaveLength(0);
    expect(result.reasoning_summary).toBe("Stabilization is strongly validated.");
  });

  it("appends guardrail override note when guardrails change LLM proposed status", async () => {
    // LLM proposes GREEN but Guardrail A forces RED (demand strong + no coverage)
    vi.mocked(fetch).mockResolvedValueOnce(
      makeLLMResponse({
        proposed_status: "GREEN",
        confidence: 0.9,
        reasoning_summary: "Stabilization is strongly validated, indicating a GREEN status.",
        contradiction_detected: false,
        key_evidence: [],
      }),
    );

    // Two demand signals (demand = 2.0 ≥ threshold 1.0) → demandStrong=true, no coverage → Guardrail A fires
    const result = await evaluateNeedStatusWithLLM(
      [
        { state: "demand", confidence: 1.0 },
        { state: "demand", confidence: 1.0 },
      ],
      "ORANGE",
      { lovableApiKey: "test-key" },
    );

    expect(result.llm_used).toBe(true);
    expect(result.status).toBe("RED");
    expect(result.guardrailsApplied).toContain("Guardrail A");
    // reasoning_summary must include the original LLM text
    expect(result.reasoning_summary).toContain(
      "Stabilization is strongly validated, indicating a GREEN status.",
    );
    // and must also include which guardrail(s) fired and the final status
    expect(result.reasoning_summary).toContain("Transition overridden by:");
    expect(result.reasoning_summary).toContain("Guardrail A");
    expect(result.reasoning_summary).toContain("Final status: RED");
  });

  it("falls back to rule-based reasoning when LLM is unavailable", async () => {
    // No API key → LLM path skipped, buildHumanReasoning used
    const result = await evaluateNeedStatusWithLLM(
      [{ state: "needed", confidence: 1.0 }],
      undefined,
      {},
    );

    expect(result.llm_used).toBe(false);
    expect(result.reasoning_summary.length).toBeGreaterThan(0);
    // Rule-based reasoning should mention the final status label
    expect(result.reasoning_summary).toMatch(/Critical|High|Medium|Low|Monitoring/);
  });
});

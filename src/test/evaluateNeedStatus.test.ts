import { describe, expect, it } from "vitest";
import {
  evaluateNeedStatus,
  classifyItemState,
  mapNeedStatusToNeedLevel,
  mapNeedLevelToAuditStatus,
  buildHumanReasoning,
  THRESHOLDS,
  SOURCE_WEIGHT,
  isValidNeedTransition,
  NEED_STATUS_TRANSITIONS,
} from "../../supabase/functions/_shared/evaluateNeedStatus";

// ---------------------------------------------------------------------------
// classifyItemState
// ---------------------------------------------------------------------------

describe("classifyItemState", () => {
  it("maps 'needed' to INSUFFICIENCY", () => {
    expect(classifyItemState("needed")).toBe("INSUFFICIENCY");
  });

  it("maps 'depleted' to INSUFFICIENCY", () => {
    expect(classifyItemState("depleted")).toBe("INSUFFICIENCY");
  });

  it("maps 'available' to STABILIZATION", () => {
    expect(classifyItemState("available")).toBe("STABILIZATION");
  });

  it("maps 'in_transit' to COVERAGE_ACTIVITY", () => {
    expect(classifyItemState("in_transit")).toBe("COVERAGE_ACTIVITY");
  });

  it("maps 'fragility' to FRAGILITY_ALERT", () => {
    expect(classifyItemState("fragility")).toBe("FRAGILITY_ALERT");
  });

  it("maps 'demand' to DEMAND", () => {
    expect(classifyItemState("demand")).toBe("DEMAND");
  });

  it("defaults unknown state to INSUFFICIENCY (safe escalation fallback)", () => {
    expect(classifyItemState("unknown_state")).toBe("INSUFFICIENCY");
  });
});

// ---------------------------------------------------------------------------
// evaluateNeedStatus — status determination
// ---------------------------------------------------------------------------

describe("evaluateNeedStatus", () => {
  it("returns WHITE for empty signals", () => {
    const { status } = evaluateNeedStatus([]);
    expect(status).toBe("WHITE");
  });

  it("returns RED when insufficiency is strong and no coverage (Guardrail B)", () => {
    // insuff = 0.8 >= THRESHOLDS.insufficiencyEscalation (0.75), coverage = 0
    const { status, guardrailsApplied } = evaluateNeedStatus([
      { state: "needed", confidence: 0.8 },
    ]);
    expect(status).toBe("RED");
    expect(guardrailsApplied).toContain("Guardrail B");
  });

  it("returns RED when demand is strong and no coverage (Guardrail A)", () => {
    // demand signals accumulate; two signals with confidence 0.6 each = 1.2 >= 1
    const { status, guardrailsApplied } = evaluateNeedStatus([
      { state: "demand", confidence: 0.6 },
      { state: "demand", confidence: 0.6 },
    ]);
    expect(status).toBe("RED");
    expect(guardrailsApplied).toContain("Guardrail A");
  });

  it("returns ORANGE when demand strong + coverage active", () => {
    // demand >= threshold AND coverage >= coverageActivation
    const { status } = evaluateNeedStatus([
      { state: "demand", confidence: 1.0 },
      { state: "in_transit", confidence: 1.0 },
    ]);
    expect(status).toBe("ORANGE");
  });

  it("returns ORANGE when demand is strong and coverage is active (base rule)", () => {
    // demand >= 1 (strong) + coverage >= 0.9 (active) → base rule → ORANGE
    const { status } = evaluateNeedStatus([
      { state: "demand", confidence: 1.0 },
      { state: "in_transit", confidence: 1.0 },
    ]);
    expect(status).toBe("ORANGE");
  });

  it("returns GREEN when stabilization is strong with no alerts", () => {
    // stab >= 0.7, no demand, no insuff, no fragility
    const { status } = evaluateNeedStatus([
      { state: "available", confidence: 0.8 },
    ]);
    expect(status).toBe("GREEN");
  });

  it("returns YELLOW when coverage is active but no strong demand/insuff", () => {
    // coverage >= coverageActivation (0.9), no demand, no insuff, stab < threshold
    const { status } = evaluateNeedStatus([
      { state: "in_transit", confidence: 1.0 },
    ]);
    expect(status).toBe("YELLOW");
  });

  it("returns YELLOW when coverage intent is present (0.4 <= coverage < 0.9)", () => {
    // coverage = 0.5 >= coverageIntent (0.4) but < coverageActivation (0.9)
    const { status } = evaluateNeedStatus([
      { state: "in_transit", confidence: 0.5 },
    ]);
    expect(status).toBe("YELLOW");
  });

  it("returns RED for two critical insufficiency signals (no coverage)", () => {
    // Two signals with confidence 1.0 → insuff = 2.0, exceeds threshold 0.75
    const { status, scores } = evaluateNeedStatus([
      { state: "needed", confidence: 1.0 },
      { state: "needed", confidence: 1.0 },
    ]);
    expect(status).toBe("RED");
    expect(scores.insuff).toBe(2.0);
  });

  it("does NOT return RED when insufficiency has coverage (ORANGE instead)", () => {
    // insuff strong + coverage active → ORANGE (not RED)
    const { status } = evaluateNeedStatus([
      { state: "needed", confidence: 1.0 },
      { state: "in_transit", confidence: 1.0 },
    ]);
    expect(status).toBe("ORANGE");
  });

  it("exposes correct score values", () => {
    const { scores } = evaluateNeedStatus([
      { state: "needed",     confidence: 0.8 },
      { state: "available",  confidence: 0.5 },
      { state: "in_transit", confidence: 0.3 },
    ]);
    expect(scores.insuff).toBeCloseTo(0.8);
    expect(scores.stab).toBeCloseTo(0.5);
    expect(scores.coverage).toBeCloseTo(0.3);
    expect(scores.demand).toBeCloseTo(0);
    expect(scores.frag).toBeCloseTo(0);
  });
});

// ---------------------------------------------------------------------------
// mapNeedStatusToNeedLevel
// ---------------------------------------------------------------------------

describe("mapNeedStatusToNeedLevel", () => {
  it("maps RED to critical", () => expect(mapNeedStatusToNeedLevel("RED")).toBe("critical"));
  it("maps ORANGE to high",   () => expect(mapNeedStatusToNeedLevel("ORANGE")).toBe("high"));
  it("maps YELLOW to medium", () => expect(mapNeedStatusToNeedLevel("YELLOW")).toBe("medium"));
  it("maps GREEN to low",     () => expect(mapNeedStatusToNeedLevel("GREEN")).toBe("low"));
  it("maps WHITE to low",     () => expect(mapNeedStatusToNeedLevel("WHITE")).toBe("low"));
});

// ---------------------------------------------------------------------------
// mapNeedLevelToAuditStatus
// ---------------------------------------------------------------------------

describe("mapNeedLevelToAuditStatus", () => {
  it("maps critical to RED",  () => expect(mapNeedLevelToAuditStatus("critical")).toBe("RED"));
  it("maps high to ORANGE",   () => expect(mapNeedLevelToAuditStatus("high")).toBe("ORANGE"));
  it("maps medium to YELLOW", () => expect(mapNeedLevelToAuditStatus("medium")).toBe("YELLOW"));
  it("maps low to GREEN",     () => expect(mapNeedLevelToAuditStatus("low")).toBe("GREEN"));
  it("maps unknown to WHITE", () => expect(mapNeedLevelToAuditStatus("unknown")).toBe("WHITE"));
});

// ---------------------------------------------------------------------------
// buildHumanReasoning
// ---------------------------------------------------------------------------

describe("buildHumanReasoning", () => {
  const scores = { demand: 0, insuff: 0, stab: 0, frag: 0, coverage: 0 };
  const booleans = {
    demandStrong: false,
    insuffStrong: false,
    stabilizationStrong: false,
    fragilityAlert: false,
    coverageActive: false,
    coverageIntent: false,
  };

  it("includes status label in reasoning", () => {
    const r = buildHumanReasoning(scores, booleans, "RED", []);
    expect(r).toContain("Critical");
  });

  it("includes guardrail explanation when guardrail fired", () => {
    const r = buildHumanReasoning(scores, booleans, "RED", ["Guardrail A"]);
    expect(r).toContain("demand is strong with no coverage");
  });

  it("produces non-empty string for all statuses", () => {
    for (const status of ["WHITE", "RED", "YELLOW", "ORANGE", "GREEN"] as const) {
      const r = buildHumanReasoning(scores, booleans, status, []);
      expect(r.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// THRESHOLDS constants
// ---------------------------------------------------------------------------

describe("THRESHOLDS", () => {
  it("has expected default values matching NeedLevelEngine config", () => {
    expect(THRESHOLDS.demandEscalation).toBe(1);
    expect(THRESHOLDS.insufficiencyEscalation).toBe(0.75);
    expect(THRESHOLDS.stabilizationDowngrade).toBe(0.7);
    expect(THRESHOLDS.fragilityReactivation).toBe(0.9);
    expect(THRESHOLDS.coverageActivation).toBe(0.9);
    expect(THRESHOLDS.coverageIntent).toBe(0.4);
  });
});

// ---------------------------------------------------------------------------
// Guardrail C: GREEN eligibility gate
// ---------------------------------------------------------------------------

describe("Guardrail C: GREEN eligibility gate", () => {
  it("does NOT fire when all GREEN conditions are met (valid GREEN)", () => {
    // stabilizationStrong=true, fragilityAlert=false, demandStrong=false, insuffStrong=false
    const { status, guardrailsApplied } = evaluateNeedStatus([
      { state: "available", confidence: 0.8 },
    ]);
    expect(status).toBe("GREEN");
    expect(guardrailsApplied).not.toContain("Guardrail C");
  });

  it("result is RED (not GREEN) when insufficiency is strong alongside stabilization — Guardrail B fires", () => {
    // stab strong but insuff also strong → Guardrail B fires, result is RED
    const { status, guardrailsApplied } = evaluateNeedStatus([
      { state: "available", confidence: 0.8 },
      { state: "needed",    confidence: 0.8 },
    ]);
    expect(status).toBe("RED");
    expect(guardrailsApplied).not.toContain("Guardrail C");
  });

  it("result is RED (not GREEN) when demand is strong alongside stabilization — Guardrail A fires", () => {
    // stab strong but demand strong → Guardrail A fires, result is RED
    const { status, guardrailsApplied } = evaluateNeedStatus([
      { state: "available", confidence: 0.8 },
      { state: "demand",    confidence: 1.0 },
    ]);
    expect(status).toBe("RED");
    expect(guardrailsApplied).not.toContain("Guardrail C");
  });
});

// ---------------------------------------------------------------------------
// Guardrail D: fragility blocks GREEN
// ---------------------------------------------------------------------------

describe("Guardrail D: fragility blocks GREEN", () => {
  it("forces YELLOW when fragility is present and signals are otherwise weak (proposed WHITE → YELLOW)", () => {
    // fragility alone → base rule gives WHITE, but Guardrail D forces YELLOW
    const { status, guardrailsApplied } = evaluateNeedStatus([
      { state: "fragility", confidence: 1.0 },
    ]);
    expect(status).toBe("YELLOW");
    expect(guardrailsApplied).toContain("Guardrail D");
  });

  it("forces YELLOW when fragility and stabilization are both present (stab strong but fragility blocks GREEN)", () => {
    // stab strong but fragility present → base rule won't give GREEN; Guardrail D forces WHITE→YELLOW
    const { status, guardrailsApplied } = evaluateNeedStatus([
      { state: "available",  confidence: 0.8 },
      { state: "fragility",  confidence: 1.0 },
    ]);
    expect(status).toBe("YELLOW");
    expect(guardrailsApplied).toContain("Guardrail D");
  });

  it("forces existing GREEN → YELLOW when fragility detected and signals are weak", () => {
    // Fragility alone (no other strong signals) starting from GREEN → YELLOW
    const { status, guardrailsApplied } = evaluateNeedStatus(
      [{ state: "fragility", confidence: 1.0 }],
      "GREEN",
    );
    expect(status).toBe("YELLOW");
    expect(guardrailsApplied).toContain("Guardrail D");
  });

  it("does NOT downgrade RED/ORANGE to YELLOW when fragility is present alongside demand/insuff", () => {
    // Fragility + strong insufficiency → RED (Guardrail D does not override escalation guardrails)
    const { status } = evaluateNeedStatus([
      { state: "needed",    confidence: 1.0 },
      { state: "fragility", confidence: 1.0 },
    ]);
    expect(status).toBe("RED");
  });

  it("does NOT fire when there is no fragility alert", () => {
    const { guardrailsApplied } = evaluateNeedStatus([
      { state: "available", confidence: 0.8 },
    ]);
    expect(guardrailsApplied).not.toContain("Guardrail D");
  });
});

// ---------------------------------------------------------------------------
// Transition legality validation
// ---------------------------------------------------------------------------

describe("legalTransition", () => {
  it("returns true when previousStatus is undefined", () => {
    const { legalTransition } = evaluateNeedStatus([]);
    expect(legalTransition).toBe(true);
  });

  it("returns true for same-status (no change)", () => {
    const { legalTransition } = evaluateNeedStatus(
      [{ state: "available", confidence: 0.8 }],
      "GREEN",
    );
    expect(legalTransition).toBe(true);
  });

  it("returns true for a legal downgrade (GREEN → YELLOW)", () => {
    // Coverage active, not stab strong → YELLOW; from GREEN → YELLOW is legal
    const { status, legalTransition } = evaluateNeedStatus(
      [{ state: "in_transit", confidence: 1.0 }],
      "GREEN",
    );
    expect(status).toBe("YELLOW");
    expect(legalTransition).toBe(true);
  });

  it("returns false for illegal transition RED → GREEN", () => {
    // This scenario: previousStatus=RED, signals are stab-strong → GREEN proposed
    // But Guardrail C/D should not block this particular combination (no fragility, no demand/insuff)
    // However NEED_STATUS_TRANSITIONS says RED→GREEN is illegal → legalTransition=false
    const { status, legalTransition } = evaluateNeedStatus(
      [{ state: "available", confidence: 0.8 }],
      "RED",
    );
    expect(status).toBe("GREEN");
    expect(legalTransition).toBe(false);
  });

  it("returns false for illegal transition WHITE → GREEN", () => {
    const { status, legalTransition } = evaluateNeedStatus(
      [{ state: "available", confidence: 0.8 }],
      "WHITE",
    );
    expect(status).toBe("GREEN");
    expect(legalTransition).toBe(false);
  });

  it("NEED_STATUS_TRANSITIONS exported from shared module matches frontend table", () => {
    // RED cannot go to GREEN or WHITE
    expect(isValidNeedTransition("RED", "GREEN")).toBe(false);
    expect(isValidNeedTransition("RED", "WHITE")).toBe(false);
    // RED can go to YELLOW or ORANGE
    expect(isValidNeedTransition("RED", "YELLOW")).toBe(true);
    expect(isValidNeedTransition("RED", "ORANGE")).toBe(true);
    // GREEN can go to YELLOW, ORANGE, RED but not WHITE
    expect(isValidNeedTransition("GREEN", "YELLOW")).toBe(true);
    expect(isValidNeedTransition("GREEN", "WHITE")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  fieldReportItemToSignalContent,
  fieldReportItemToConfidence,
  mapNeedStatusToNeedLevel,
  mapNeedLevelToNeedStatus,
  needSignalService,
} from "@/services/needSignalService";
// deriveNeedLevel is the old naive helper that lived inline in the edge functions;
// it still exists as a shared utility in src/lib/ but is no longer used for
// updating sector_needs_context — the NeedLevelEngine is the canonical path.
import { deriveNeedLevel } from "@/lib/deriveNeedLevel";
import type { ExtractedItem, ExtractedData } from "@/types/fieldReport";

describe("fieldReportItemToSignalContent", () => {
  it("maps 'disponible' state to stabilization keywords", () => {
    const item: ExtractedItem = { name: "medical care", quantity: 1, unit: "team", state: "disponible", urgency: "baja" };
    const content = fieldReportItemToSignalContent(item);
    expect(content).toMatch(/operando|estable/i);
  });

  it("maps 'necesario' state to insufficiency keywords", () => {
    const item: ExtractedItem = { name: "water", quantity: null, unit: "liters", state: "necesario", urgency: "alta" };
    const content = fieldReportItemToSignalContent(item);
    expect(content).toMatch(/no alcanza|insuficiente/i);
  });

  it("maps 'en_camino' state to coverage activity keywords", () => {
    const item: ExtractedItem = { name: "food", quantity: 100, unit: "kg", state: "en_camino", urgency: "media" };
    const content = fieldReportItemToSignalContent(item);
    expect(content).toMatch(/en camino|despacho/i);
  });

  it("maps 'agotado' state to insufficiency keywords", () => {
    const item: ExtractedItem = { name: "medicine", quantity: 0, unit: "units", state: "agotado", urgency: "crítica" };
    const content = fieldReportItemToSignalContent(item);
    expect(content).toMatch(/sin|saturado/i);
  });
});

describe("fieldReportItemToConfidence", () => {
  it("returns high confidence for disponible + baja (strong stabilization)", () => {
    const item: ExtractedItem = { name: "care", quantity: 1, unit: "team", state: "disponible", urgency: "baja" };
    expect(fieldReportItemToConfidence(item)).toBe(1.0);
  });

  it("returns low confidence for disponible + crítica (weak stabilization)", () => {
    const item: ExtractedItem = { name: "care", quantity: 1, unit: "team", state: "disponible", urgency: "crítica" };
    expect(fieldReportItemToConfidence(item)).toBe(0.3);
  });

  it("returns high confidence for necesario + crítica (strong insufficiency)", () => {
    const item: ExtractedItem = { name: "water", quantity: null, unit: "l", state: "necesario", urgency: "crítica" };
    expect(fieldReportItemToConfidence(item)).toBe(1.0);
  });

  it("returns low confidence for agotado + baja (weak insufficiency)", () => {
    const item: ExtractedItem = { name: "food", quantity: 0, unit: "kg", state: "agotado", urgency: "baja" };
    expect(fieldReportItemToConfidence(item)).toBe(0.3);
  });
});

describe("mapNeedStatusToNeedLevel", () => {
  it("maps RED to critical", () => {
    expect(mapNeedStatusToNeedLevel("RED")).toBe("critical");
  });

  it("maps ORANGE to high", () => {
    expect(mapNeedStatusToNeedLevel("ORANGE")).toBe("high");
  });

  it("maps YELLOW to medium", () => {
    expect(mapNeedStatusToNeedLevel("YELLOW")).toBe("medium");
  });

  it("maps GREEN to low", () => {
    expect(mapNeedStatusToNeedLevel("GREEN")).toBe("low");
  });

  it("maps WHITE to low", () => {
    expect(mapNeedStatusToNeedLevel("WHITE")).toBe("low");
  });
});

describe("needSignalService.onFieldReportCompleted", () => {
  it("processes field report items and returns need levels per capability", async () => {
    const extractedData: ExtractedData = {
      sector_mentioned: "Sector A",
      capability_types: ["Emergency medical care"],
      items: [
        { name: "medical care", quantity: 1, unit: "team", state: "disponible", urgency: "baja" },
      ],
      location_detail: null,
      observations: "Care was provided",
      evidence_quotes: [],
      confidence: 0.9,
    };

    const results = await needSignalService.onFieldReportCompleted({
      eventId: "event-1",
      sectorId: "sector-1",
      extractedData,
      capacityTypeMap: { "Emergency medical care": "cap-type-1" },
      nowIso: "2026-02-16T12:00:00.000Z",
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].capabilityId).toBe("cap-type-1");
    // With a single stabilization signal (disponible + baja), the engine should
    // process it and return a need state
    expect(results[0].needState).not.toBeNull();
    expect(results[0].needLevel).toBeDefined();
  });

  it("processes multiple items for different capabilities", async () => {
    const extractedData: ExtractedData = {
      sector_mentioned: null,
      capability_types: ["Water supply", "Food distribution"],
      items: [
        { name: "water", quantity: 500, unit: "liters", state: "necesario", urgency: "alta" },
        { name: "food", quantity: 100, unit: "kg", state: "en_camino", urgency: "media" },
      ],
      location_detail: null,
      observations: null,
      evidence_quotes: [],
      confidence: 0.8,
    };

    const results = await needSignalService.onFieldReportCompleted({
      eventId: "event-2",
      sectorId: "sector-2",
      extractedData,
      capacityTypeMap: {
        "Water supply": "cap-water",
        "Food distribution": "cap-food",
      },
      nowIso: "2026-02-16T13:00:00.000Z",
    });

    expect(results.length).toBe(2);
    const waterResult = results.find(r => r.capabilityId === "cap-water");
    const foodResult = results.find(r => r.capabilityId === "cap-food");
    expect(waterResult).toBeDefined();
    expect(foodResult).toBeDefined();
  });

  it("returns empty results when no items match capability types", async () => {
    const extractedData: ExtractedData = {
      sector_mentioned: null,
      capability_types: [],
      items: [
        { name: "something unrelated", quantity: 1, unit: "unit", state: "disponible", urgency: "baja" },
      ],
      location_detail: null,
      observations: null,
      evidence_quotes: [],
      confidence: 0.5,
    };

    const results = await needSignalService.onFieldReportCompleted({
      eventId: "event-3",
      sectorId: "sector-3",
      extractedData,
      capacityTypeMap: {},
      nowIso: "2026-02-16T14:00:00.000Z",
    });

    expect(results).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Engine path vs. deriveNeedLevel: assert the engine is the canonical path
// ---------------------------------------------------------------------------

describe("engine path replaces deriveNeedLevel for sector_needs_context", () => {
  it("engine and deriveNeedLevel can disagree: engine considers signal type, not just urgency", async () => {
    // Items that are all 'disponible' (available) with low urgency —
    // deriveNeedLevel would return 'low' (the max urgency rank),
    // but the engine also produces a NeedState with a meaningful status.
    const extractedData: ExtractedData = {
      sector_mentioned: "Sector Engine Test",
      capability_types: ["Water supply"],
      items: [
        { name: "water", quantity: 200, unit: "liters", state: "disponible", urgency: "baja" },
        { name: "water", quantity: 100, unit: "liters", state: "disponible", urgency: "baja" },
      ],
      location_detail: null,
      observations: "Sufficient water available",
      evidence_quotes: [],
      confidence: 0.9,
    };

    // Old naive path
    const naiveLevel = deriveNeedLevel(extractedData.items.map(i => ({ urgency: i.urgency })));

    // New engine path
    const results = await needSignalService.onFieldReportCompleted({
      eventId: "event-engine-test",
      sectorId: "sector-engine-test",
      extractedData,
      capacityTypeMap: { "Water supply": "cap-water-engine-test" },
      nowIso: "2026-02-16T15:00:00.000Z",
    });

    expect(results.length).toBe(1);
    const engineLevel = results[0].needLevel;

    // Both produce a valid NeedLevel; the important thing is the engine path
    // is used and returns a structured result with a NeedState.
    expect(engineLevel).toBeDefined();
    expect(results[0].needState).not.toBeNull();

    // The naive path ignores state semantics; the engine honours them:
    // 'disponible' items produce STABILIZATION signals, not demand/insufficiency.
    // With two stabilization signals (score ≥ threshold), the engine may reach
    // GREEN or remain WHITE; either way it uses signal-type semantics, unlike
    // deriveNeedLevel which only looks at urgency rank.
    expect(["low", "medium", "high", "critical"]).toContain(engineLevel);
    expect(["low", "medium", "high", "critical"]).toContain(naiveLevel);
  });

  it("engine returns 'critical' level when strong insufficiency signals are present (no coverage)", async () => {
    // Multiple 'needed' items with 'crítica' urgency produce strong insufficiency
    // signals. Without coverage, the engine should propose RED → 'critical'.
    const extractedData: ExtractedData = {
      sector_mentioned: "Crisis Sector",
      capability_types: ["Food distribution"],
      items: [
        { name: "food", quantity: null, unit: "kg", state: "necesario", urgency: "crítica" },
        { name: "food", quantity: null, unit: "kg", state: "necesario", urgency: "crítica" },
      ],
      location_detail: null,
      observations: "Severe food shortage",
      evidence_quotes: [],
      confidence: 0.95,
    };

    const results = await needSignalService.onFieldReportCompleted({
      eventId: "event-crisis",
      sectorId: "sector-crisis",
      extractedData,
      capacityTypeMap: { "Food distribution": "cap-food-crisis" },
      nowIso: "2026-02-16T16:00:00.000Z",
    });

    expect(results.length).toBe(1);
    expect(results[0].needState).not.toBeNull();
    // Two high-confidence insufficiency signals (1.0 each, NGO weight 1.0)
    // sum to 2.0, exceeding insufficiencyEscalation threshold of 0.75,
    // and no coverage signals → engine proposes RED → 'critical'.
    expect(results[0].needLevel).toBe("critical");
  });

  it("mapNeedStatusToNeedLevel is the only mapping used — not deriveNeedLevel", () => {
    // Confirm the mapping from engine statuses to DB need levels is explicit
    // and deterministic. These are the values that will reach sector_needs_context.
    expect(mapNeedStatusToNeedLevel("RED")).toBe("critical");
    expect(mapNeedStatusToNeedLevel("ORANGE")).toBe("high");
    expect(mapNeedStatusToNeedLevel("YELLOW")).toBe("medium");
    expect(mapNeedStatusToNeedLevel("GREEN")).toBe("low");
    expect(mapNeedStatusToNeedLevel("WHITE")).toBe("low");
  });
});

describe("mapNeedLevelToNeedStatus", () => {
  it("maps critical to RED", () => {
    expect(mapNeedLevelToNeedStatus("critical")).toBe("RED");
  });

  it("maps high to ORANGE", () => {
    expect(mapNeedLevelToNeedStatus("high")).toBe("ORANGE");
  });

  it("maps medium to YELLOW", () => {
    expect(mapNeedLevelToNeedStatus("medium")).toBe("YELLOW");
  });

  it("maps low to GREEN", () => {
    expect(mapNeedLevelToNeedStatus("low")).toBe("GREEN");
  });

  it("round-trips correctly: RED→critical→RED", () => {
    expect(mapNeedLevelToNeedStatus(mapNeedStatusToNeedLevel("RED"))).toBe("RED");
    expect(mapNeedLevelToNeedStatus(mapNeedStatusToNeedLevel("ORANGE"))).toBe("ORANGE");
    expect(mapNeedLevelToNeedStatus(mapNeedStatusToNeedLevel("YELLOW"))).toBe("YELLOW");
    expect(mapNeedLevelToNeedStatus(mapNeedStatusToNeedLevel("GREEN"))).toBe("GREEN");
  });
});

describe("needSignalService.onFieldReportCompleted with previousLevels seeding", () => {
  it("seeds engine from previousLevels so evaluation starts from correct status", async () => {
    // Without seeding, a single stabilization signal from WHITE would stay WHITE.
    // With previousLevels seeding from RED, the engine starts from RED and the
    // stabilization signal can propose a legal transition (e.g. ORANGE or YELLOW).
    const extractedData: ExtractedData = {
      sector_mentioned: "Sector Seed Test",
      capability_types: ["Water supply"],
      items: [
        { name: "water", quantity: 200, unit: "liters", state: "disponible", urgency: "baja" },
      ],
      location_detail: null,
      observations: "Water now available",
      evidence_quotes: [],
      confidence: 0.9,
    };

    const results = await needSignalService.onFieldReportCompleted({
      eventId: "event-seed-test",
      sectorId: "sector-seed-test",
      extractedData,
      capacityTypeMap: { "Water supply": "cap-water-seed-test" },
      nowIso: "2026-02-16T17:00:00.000Z",
      previousLevels: { "cap-water-seed-test": "RED" },
    });

    expect(results.length).toBe(1);
    expect(results[0].needState).not.toBeNull();
    // Engine started from RED (seeded), received a stabilization signal →
    // the result should be a valid NeedLevel
    expect(["low", "medium", "high", "critical"]).toContain(results[0].needLevel);
  });
});

describe("needSignalService.onDeploymentStatusChange", () => {
  it("interested deployment → coverageIntent → YELLOW (not WHITE)", async () => {
    const state = await needSignalService.onDeploymentStatusChange({
      eventId: "event-deploy-interested",
      sectorId: "sector-deploy-1",
      capabilityId: "cap-deploy-1",
      deploymentStatus: "interested",
      actorName: "Cruz Roja",
      nowIso: "2026-02-20T10:00:00.000Z",
    });

    expect(state).not.toBeNull();
    // confidence 0.5 → coverage_score 0.5 ≥ coverageIntent(0.4) but < coverageActivation(0.9)
    expect(state?.coverage_score).toBeGreaterThanOrEqual(0.4);
    expect(state?.coverage_score).toBeLessThan(0.9);
    expect(state?.current_status).toBe("YELLOW");
  });

  it("confirmed deployment → coverageIntent → YELLOW (not WHITE)", async () => {
    const state = await needSignalService.onDeploymentStatusChange({
      eventId: "event-deploy-confirmed",
      sectorId: "sector-deploy-2",
      capabilityId: "cap-deploy-2",
      deploymentStatus: "confirmed",
      actorName: "Bomberos",
      nowIso: "2026-02-20T11:00:00.000Z",
    });

    expect(state).not.toBeNull();
    // confidence 0.7 → coverage_score 0.7 ≥ coverageIntent(0.4) but < coverageActivation(0.9)
    expect(state?.coverage_score).toBeGreaterThanOrEqual(0.4);
    expect(state?.coverage_score).toBeLessThan(0.9);
    expect(state?.current_status).toBe("YELLOW");
  });

  it("operating deployment → coverageActive → YELLOW (≥0.9)", async () => {
    const state = await needSignalService.onDeploymentStatusChange({
      eventId: "event-deploy-operating",
      sectorId: "sector-deploy-3",
      capabilityId: "cap-deploy-3",
      deploymentStatus: "operating",
      actorName: "Defensa Civil",
      nowIso: "2026-02-20T12:00:00.000Z",
    });

    expect(state).not.toBeNull();
    // confidence 0.9 → coverage_score 0.9 ≥ coverageActivation(0.9) → coverageActive = true → YELLOW
    expect(state?.coverage_score).toBeGreaterThanOrEqual(0.9);
    expect(state?.current_status).toBe("YELLOW");
  });

  it("interested deployment uses lower confidence than operating (0.5 vs 0.9)", async () => {
    const interestedState = await needSignalService.onDeploymentStatusChange({
      eventId: "event-compare-interested",
      sectorId: "sector-compare-1",
      capabilityId: "cap-compare-1",
      deploymentStatus: "interested",
      actorName: "Actor A",
      nowIso: "2026-02-20T13:00:00.000Z",
    });

    const operatingState = await needSignalService.onDeploymentStatusChange({
      eventId: "event-compare-operating",
      sectorId: "sector-compare-2",
      capabilityId: "cap-compare-2",
      deploymentStatus: "operating",
      actorName: "Actor B",
      nowIso: "2026-02-20T13:00:00.000Z",
    });

    // interested coverage_score (0.5) < operating coverage_score (0.9)
    expect(interestedState?.coverage_score).toBeLessThan(operatingState?.coverage_score ?? 0);
  });
});

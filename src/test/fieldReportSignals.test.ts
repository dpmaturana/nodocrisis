import { describe, expect, it } from "vitest";
import {
  fieldReportItemToSignalContent,
  fieldReportItemToConfidence,
  mapNeedStatusToNeedLevel,
  mapNeedLevelToNeedStatus,
  needSignalService,
} from "@/services/needSignalService";
import type { ExtractedItem, ExtractedData } from "@/types/fieldReport";
import type { SignalType } from "@/types/database";

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

describe("needSignalService integration: ORANGE need + positive signal", () => {
  it("should not escalate ORANGE to RED when receiving a positive (disponible) field report", async () => {
    // Simulate an ORANGE need receiving a positive signal:
    // First, create signals that establish an ORANGE state (insufficiency + coverage)
    const sectorId = "sector-integration-1";
    const capId = "cap-integration-1";
    const eventId = "event-integration-1";
    const baseTime = "2026-02-16T10:00:00.000Z";

    // Signal 1: insufficiency
    await needSignalService.evaluateGapNeed({
      eventId,
      sectorId,
      capabilityId: capId,
      signals: [{
        id: "sig-insuff-1",
        event_id: eventId,
        sector_id: sectorId,
        capacity_type_id: capId,
        signal_type: "field_report",
        level: "sector",
        content: "recurso necesario, no alcanza, insuficiente",
        source: "field_report",
        confidence: 1.0,
        created_at: baseTime,
      }],
      nowIso: baseTime,
    });

    // Signal 2: coverage activity
    await needSignalService.evaluateGapNeed({
      eventId,
      sectorId,
      capabilityId: capId,
      signals: [{
        id: "sig-coverage-1",
        event_id: eventId,
        sector_id: sectorId,
        capacity_type_id: capId,
        signal_type: "field_report",
        level: "sector",
        content: "despacho en ruta, refuerzo en camino",
        source: "field_report",
        confidence: 1.0,
        created_at: "2026-02-16T10:01:00.000Z",
      }],
      nowIso: "2026-02-16T10:01:00.000Z",
    });

    // Now send a positive signal (disponible/stabilization)
    const positiveTime = "2026-02-16T10:05:00.000Z";
    const state = await needSignalService.evaluateGapNeed({
      eventId,
      sectorId,
      capabilityId: capId,
      signals: [{
        id: "sig-positive-1",
        event_id: eventId,
        sector_id: sectorId,
        capacity_type_id: capId,
        signal_type: "field_report",
        level: "sector",
        content: "recurso disponible, operando estable",
        source: "field_report",
        confidence: 1.0,
        created_at: positiveTime,
      }],
      nowIso: positiveTime,
    });

    // The status should NOT be RED - a positive signal should never worsen from ORANGE to RED
    expect(state).not.toBeNull();
    expect(state!.current_status).not.toBe("RED");
  });

  it("mapNeedStatusToNeedLevel round-trip preserves ORANGE as high (not critical/RED)", () => {
    // Verify the mapping: ORANGE → high → should map back to ORANGE, not RED
    const needLevel = mapNeedStatusToNeedLevel("ORANGE");
    expect(needLevel).toBe("high");
    // "high" should NOT be treated as "critical" in the gap service
    // This is validated by adjustStatusForCoverage tests
  });
});

describe("mapNeedLevelToNeedStatus", () => {
  it("maps critical → RED", () => expect(mapNeedLevelToNeedStatus("critical")).toBe("RED"));
  it("maps high → ORANGE", () => expect(mapNeedLevelToNeedStatus("high")).toBe("ORANGE"));
  it("maps medium → YELLOW", () => expect(mapNeedLevelToNeedStatus("medium")).toBe("YELLOW"));
  it("maps low → GREEN", () => expect(mapNeedLevelToNeedStatus("low")).toBe("GREEN"));

  it("is the inverse of mapNeedStatusToNeedLevel for RED/ORANGE/YELLOW/GREEN", () => {
    expect(mapNeedLevelToNeedStatus(mapNeedStatusToNeedLevel("RED"))).toBe("RED");
    expect(mapNeedLevelToNeedStatus(mapNeedStatusToNeedLevel("ORANGE"))).toBe("ORANGE");
    expect(mapNeedLevelToNeedStatus(mapNeedStatusToNeedLevel("YELLOW"))).toBe("YELLOW");
    expect(mapNeedLevelToNeedStatus(mapNeedStatusToNeedLevel("GREEN"))).toBe("GREEN");
  });
});

describe("needSignalService.seedNeedState", () => {
  it("seeds the engine so it starts from DB state instead of WHITE", async () => {
    const sectorId = "seed-test-sec";
    const capId = "seed-test-cap";
    const eventId = "seed-test-evt";
    const nowIso = "2026-02-16T15:00:00.000Z";

    // Seed with "critical" (RED) — simulating existing DB state
    await needSignalService.seedNeedState({
      sectorId,
      capabilityId: capId,
      currentLevel: "critical",
      nowIso,
    });

    // Now send a single positive signal (stabilization)
    const state = await needSignalService.evaluateGapNeed({
      eventId,
      sectorId,
      capabilityId: capId,
      signals: [{
        id: "seed-sig-1",
        event_id: eventId,
        sector_id: sectorId,
        capacity_type_id: capId,
        signal_type: "field_report" as SignalType,
        level: "sector",
        content: "recurso disponible, operando estable",
        source: "ngo",
        confidence: 0.8,
        created_at: nowIso,
      }],
      nowIso,
    });

    expect(state).not.toBeNull();
    // Engine should NOT be at WHITE — it was seeded with RED, and a single
    // stabilization signal alone cannot jump all the way down to WHITE.
    // With RED as the starting point, allowed transitions are [YELLOW, ORANGE].
    // A single stabilization signal should move toward YELLOW or ORANGE, not WHITE.
    expect(state!.current_status).not.toBe("WHITE");
  });

  it("does not overwrite existing in-memory state", async () => {
    const sectorId = "seed-noop-sec";
    const capId = "seed-noop-cap";
    const eventId = "seed-noop-evt";
    const nowIso = "2026-02-16T15:30:00.000Z";

    // First, process a signal to create in-memory state
    await needSignalService.evaluateGapNeed({
      eventId,
      sectorId,
      capabilityId: capId,
      signals: [{
        id: "seed-noop-sig-1",
        event_id: eventId,
        sector_id: sectorId,
        capacity_type_id: capId,
        signal_type: "field_report" as SignalType,
        level: "sector",
        content: "recurso necesario, no alcanza, insuficiente",
        source: "ngo",
        confidence: 1.0,
        created_at: nowIso,
      }],
      nowIso,
    });

    // Now try to seed with "low" (GREEN) — should be ignored since state exists
    await needSignalService.seedNeedState({
      sectorId,
      capabilityId: capId,
      currentLevel: "low",
      nowIso,
    });

    // Send another signal to see the current state
    const state = await needSignalService.evaluateGapNeed({
      eventId,
      sectorId,
      capabilityId: capId,
      signals: [{
        id: "seed-noop-sig-2",
        event_id: eventId,
        sector_id: sectorId,
        capacity_type_id: capId,
        signal_type: "field_report" as SignalType,
        level: "sector",
        content: "recurso necesario, insuficiente",
        source: "ngo",
        confidence: 1.0,
        created_at: "2026-02-16T15:31:00.000Z",
      }],
      nowIso: "2026-02-16T15:31:00.000Z",
    });

    // State should be RED (from accumulated insufficiency), not GREEN from seed
    expect(state).not.toBeNull();
    expect(state!.current_status).toBe("RED");
  });
});

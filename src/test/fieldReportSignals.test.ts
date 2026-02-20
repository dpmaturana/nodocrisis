import { describe, expect, it } from "vitest";
import {
  fieldReportItemToSignalContent,
  fieldReportItemToConfidence,
  mapNeedStatusToNeedLevel,
  needSignalService,
} from "@/services/needSignalService";
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

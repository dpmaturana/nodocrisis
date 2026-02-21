import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  fieldReportItemToSignalContent,
  fieldReportItemToConfidence,
  mapNeedStatusToNeedLevel,
  mapNeedLevelToNeedStatus,
  needSignalService,
} from "@/services/needSignalService";
import type { ExtractedItem, ExtractedData } from "@/types/fieldReport";

// ---------------------------------------------------------------------------
// Mock supabase.functions.invoke so no real backend calls are made in tests
// ---------------------------------------------------------------------------

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
    from: vi.fn().mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: null }),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    }),
  },
}));

// Access the mocked module via ES import (vi.mock is hoisted before imports)
import { supabase } from "@/integrations/supabase/client";

// Helper to set the mock return value for the evaluate-need endpoint.
// Uses the same mapNeedStatusToNeedLevel mapping as the real service.
function mockEvaluateNeed(
  status: string,
  scores: { demand: number; insuff: number; stab: number; frag: number; coverage: number },
) {
  vi.mocked(supabase.functions.invoke).mockResolvedValue({
    data: {
      status,
      needLevel: mapNeedStatusToNeedLevel(status as any),
      scores,
      guardrails: [],
      reasoning: "Test reasoning",
    },
    error: null,
  } as any);
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default mock response
  mockEvaluateNeed("WHITE", { demand: 0, insuff: 0, stab: 0, frag: 0, coverage: 0 });
});

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
  beforeEach(() => {
    // Default mock: stabilization result
    mockEvaluateNeed("GREEN", { demand: 0, insuff: 0, stab: 0.8, frag: 0, coverage: 0 });
  });

  it("processes field report items and calls evaluate-need for each capability", async () => {
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
    expect(results[0].needState).not.toBeNull();
    expect(results[0].needLevel).toBeDefined();
  });

  it("processes multiple items for different capabilities", async () => {
    // Override mock to return critical for this test
    mockEvaluateNeed("RED", { demand: 0, insuff: 1.0, stab: 0, frag: 0, coverage: 0 });

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
// Mapping utilities
// ---------------------------------------------------------------------------

describe("mapNeedStatusToNeedLevel is the only mapping used — not deriveNeedLevel", () => {
  it("confirms the mapping from engine statuses to DB need levels is explicit", () => {
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
  it("passes previousStatus to evaluate-need endpoint", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: {
        status: "YELLOW",
        needLevel: "medium",
        scores: { demand: 0, insuff: 0, stab: 0.5, frag: 0, coverage: 0 },
        guardrails: [],
        reasoning: "Test",
      },
      error: null,
    } as any);

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
    expect(["low", "medium", "high", "critical"]).toContain(results[0].needLevel);

    // Verify the endpoint was called with the previousStatus
    expect(supabase.functions.invoke).toHaveBeenCalledWith(
      "evaluate-need",
      expect.objectContaining({
        body: expect.objectContaining({
          previousStatus: "RED",
        }),
      }),
    );
  });
});

describe("needSignalService.onDeploymentStatusChange", () => {
  it("interested deployment → calls evaluate-need with coverage intent signal", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: {
        status: "YELLOW",
        needLevel: "medium",
        scores: { demand: 0, insuff: 0, stab: 0, frag: 0, coverage: 0.5 },
        guardrails: [],
        reasoning: "Coverage intent",
      },
      error: null,
    } as any);

    const state = await needSignalService.onDeploymentStatusChange({
      eventId: "event-deploy-interested",
      sectorId: "sector-deploy-1",
      capabilityId: "cap-deploy-1",
      deploymentStatus: "interested",
      actorName: "Cruz Roja",
      nowIso: "2026-02-20T10:00:00.000Z",
    });

    expect(state).not.toBeNull();
    expect(state?.current_status).toBe("YELLOW");
    expect(state?.coverage_score).toBe(0.5);

    // Verify the correct signal was passed: in_transit at confidence 0.5
    expect(supabase.functions.invoke).toHaveBeenCalledWith(
      "evaluate-need",
      expect.objectContaining({
        body: expect.objectContaining({
          signals: [{ state: "in_transit", confidence: 0.5 }],
        }),
      }),
    );
  });

  it("operating deployment → calls evaluate-need with confidence 0.9", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: {
        status: "YELLOW",
        needLevel: "medium",
        scores: { demand: 0, insuff: 0, stab: 0, frag: 0, coverage: 0.9 },
        guardrails: [],
        reasoning: "Coverage active",
      },
      error: null,
    } as any);

    const state = await needSignalService.onDeploymentStatusChange({
      eventId: "event-deploy-operating",
      sectorId: "sector-deploy-3",
      capabilityId: "cap-deploy-3",
      deploymentStatus: "operating",
      actorName: "Defensa Civil",
      nowIso: "2026-02-20T12:00:00.000Z",
    });

    expect(state?.coverage_score).toBe(0.9);
    expect(supabase.functions.invoke).toHaveBeenCalledWith(
      "evaluate-need",
      expect.objectContaining({
        body: expect.objectContaining({
          signals: [{ state: "in_transit", confidence: 0.9 }],
        }),
      }),
    );
  });

  it("interested uses lower confidence than operating (0.5 vs 0.9)", async () => {
    const calls: any[] = [];
    vi.mocked(supabase.functions.invoke).mockImplementation(
      async (_name: string, opts: any) => {
        calls.push(opts.body.signals[0]);
        return {
          data: {
            status: "YELLOW",
            needLevel: "medium",
            scores: { demand: 0, insuff: 0, stab: 0, frag: 0, coverage: opts.body.signals[0].confidence },
            guardrails: [],
            reasoning: "Test",
          },
          error: null,
        };
      },
    );

    await needSignalService.onDeploymentStatusChange({
      eventId: "event-compare-interested",
      sectorId: "sector-1",
      capabilityId: "cap-1",
      deploymentStatus: "interested",
      nowIso: "2026-02-20T13:00:00.000Z",
    });

    await needSignalService.onDeploymentStatusChange({
      eventId: "event-compare-operating",
      sectorId: "sector-2",
      capabilityId: "cap-2",
      deploymentStatus: "operating",
      nowIso: "2026-02-20T13:00:00.000Z",
    });

    const interestedSignal = calls[0];
    const operatingSignal = calls[1];
    expect(interestedSignal.confidence).toBeLessThan(operatingSignal.confidence);
  });
});


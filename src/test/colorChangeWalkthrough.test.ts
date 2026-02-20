/**
 * COLOR CHANGE WALKTHROUGH
 * ========================
 *
 * This test documents the COMPLETE path a color change takes when an NGO
 * sends a signal — proving that the NeedLevelEngine IS used in production,
 * and showing exactly where the "integration issue" lived.
 *
 * ─── THE 5 COLORS (NeedStatus) ────────────────────────────────────────────
 *
 *   🔴 RED    = "Crítico sin cobertura"     — strong demand, NO coverage
 *   🟠 ORANGE = "Cobertura insuficiente"     — coverage exists but insufficient
 *   🟡 YELLOW = "Cobertura en validación"    — coverage active, not yet validated
 *   🟢 GREEN  = "Estabilizado"               — stabilized over 2+ time windows
 *   ⚪ WHITE  = "Monitoreo"                  — monitoring, weak evidence
 *
 * ─── THE FULL PIPELINE ────────────────────────────────────────────────────
 *
 *   NGO submits field report (FieldStatusReport.tsx)
 *     ↓
 *   Edge function transcribes audio → AI extracts items
 *     e.g. { name: "medical care", state: "disponible", urgency: "baja" }
 *     ↓
 *   fieldReportService.processCompletedReport()          [fieldReportService.ts]
 *     ↓
 *   needSignalService.onFieldReportCompleted()            [needSignalService.ts]
 *     ↓  fieldReportItemToSignalContent("disponible") → "operando estable"
 *     ↓  mapSignalType("operando estable")            → SIGNAL_STABILIZATION
 *     ↓
 *   NeedLevelEngine.processRawInput()                    [needLevelEngine.ts]
 *     ↓  aggregateScores()  → demand/insuff/stab/frag/coverage scores
 *     ↓  evaluateBooleans() → demandStrong? insuffStrong? etc.
 *     ↓  RuleBasedNeedEvaluator.evaluate() → proposed status
 *     ↓  Guardrails (RED floor, GREEN gate, ORANGE→YELLOW block, etc.)
 *     ↓
 *   Engine returns NeedState with current_status (e.g. ORANGE)
 *     ↓
 *   mapNeedStatusToNeedLevel(ORANGE) → "high"            [needSignalService.ts]
 *     ↓
 *   eventService.addContextualDemand(level="high")       [eventService.ts]
 *     ↓  UPSERT into sector_needs_context table
 *     ↓
 *   ═══════════════ STORED IN DB AS level="high" ═══════════════
 *     ↓
 *   gapService.getGapsGroupedBySector()                  [gapService.ts]
 *     ↓  reads sector_needs_context.level = "high"
 *     ↓
 *   adjustStatusForCoverage("high", deploymentCount)
 *     ↓  mapNeedLevelToGapState("high")  → GapState
 *     ↓  mapGapStateToNeedStatus(state)  → display NeedStatus
 *     ↓
 *   Dashboard shows the color
 *
 * ─── THE INTEGRATION BUG ──────────────────────────────────────────────────
 *
 *   The engine IS used. The bug was in the LAST step.
 *
 *   mapNeedLevelToGapState() had a switch statement:
 *
 *     BEFORE (buggy):
 *       case "critical":
 *       case "high":        ← fall-through!
 *         return "critical"  → mapGapStateToNeedStatus("critical") → RED ❌
 *
 *     AFTER (fixed):
 *       case "critical":
 *         return "critical"  → RED ✅
 *       case "high":
 *       case "medium":
 *         return "partial"   → ORANGE ✅
 *
 *   This caused ORANGE to be stored as "high", then read back as RED.
 *   So a positive signal that kept the need at ORANGE appeared as RED
 *   on the dashboard — making it look like things got WORSE.
 */

import { describe, expect, it } from "vitest";
import {
  fieldReportItemToSignalContent,
  fieldReportItemToConfidence,
  mapNeedStatusToNeedLevel,
  needSignalService,
} from "@/services/needSignalService";
import { adjustStatusForCoverage } from "@/services/gapService";
import { mapGapStateToNeedStatus, type NeedStatus } from "@/lib/needStatus";
import type { ExtractedItem } from "@/types/fieldReport";
import type { SignalType } from "@/types/database";

// ─── Step 1: NGO item → signal text (fieldReportItemToSignalContent) ──────────

describe("Step 1: NGO field report item → signal text", () => {
  it("disponible → stabilization keywords", () => {
    const item: ExtractedItem = { name: "medical care", quantity: 1, unit: "team", state: "disponible", urgency: "baja" };
    expect(fieldReportItemToSignalContent(item)).toContain("operando estable");
  });

  it("necesario → insufficiency keywords", () => {
    const item: ExtractedItem = { name: "water", quantity: null, unit: "liters", state: "necesario", urgency: "alta" };
    const text = fieldReportItemToSignalContent(item);
    expect(text).toContain("no alcanza");
    expect(text).toContain("insuficiente");
  });

  it("en_camino → coverage keywords", () => {
    const item: ExtractedItem = { name: "food", quantity: 100, unit: "kg", state: "en_camino", urgency: "media" };
    expect(fieldReportItemToSignalContent(item)).toContain("en camino");
  });

  it("agotado → insufficiency keywords", () => {
    const item: ExtractedItem = { name: "medicine", quantity: 0, unit: "units", state: "agotado", urgency: "crítica" };
    const text = fieldReportItemToSignalContent(item);
    expect(text).toContain("sin stock");
  });
});

// ─── Step 2: Engine processes signals → NeedStatus ────────────────────────────

describe("Step 2: NeedLevelEngine processes signals → color", () => {
  it("insufficiency + NO coverage → RED", async () => {
    const state = await needSignalService.evaluateGapNeed({
      eventId: "wk-event",
      sectorId: "wk-sec-red",
      capabilityId: "wk-cap-red",
      signals: [{
        id: "wk-insuff-1",
        event_id: "wk-event",
        sector_id: "wk-sec-red",
        capacity_type_id: "wk-cap-red",
        signal_type: "field_report" as SignalType,
        level: "sector",
        content: "recurso necesario, no alcanza, insuficiente",
        source: "ngo",
        confidence: 1.0,
        created_at: "2026-02-16T10:00:00.000Z",
      }],
      nowIso: "2026-02-16T10:00:00.000Z",
    });
    expect(state!.current_status).toBe("RED");
  });

  it("insufficiency + coverage → ORANGE", async () => {
    const t1 = "2026-02-16T11:00:00.000Z";
    await needSignalService.evaluateGapNeed({
      eventId: "wk-event",
      sectorId: "wk-sec-orange",
      capabilityId: "wk-cap-orange",
      signals: [{
        id: "wk-insuff-2",
        event_id: "wk-event",
        sector_id: "wk-sec-orange",
        capacity_type_id: "wk-cap-orange",
        signal_type: "field_report" as SignalType,
        level: "sector",
        content: "recurso necesario, no alcanza, insuficiente",
        source: "ngo",
        confidence: 1.0,
        created_at: t1,
      }],
      nowIso: t1,
    });
    const t2 = "2026-02-16T11:01:00.000Z";
    const state = await needSignalService.evaluateGapNeed({
      eventId: "wk-event",
      sectorId: "wk-sec-orange",
      capabilityId: "wk-cap-orange",
      signals: [{
        id: "wk-cov-2",
        event_id: "wk-event",
        sector_id: "wk-sec-orange",
        capacity_type_id: "wk-cap-orange",
        signal_type: "field_report" as SignalType,
        level: "sector",
        content: "despacho en ruta, refuerzo en camino",
        source: "ngo",
        confidence: 1.0,
        created_at: t2,
      }],
      nowIso: t2,
    });
    expect(state!.current_status).toBe("ORANGE");
  });
});

// ─── Step 3: Engine output → DB level (mapNeedStatusToNeedLevel) ──────────────

describe("Step 3: Engine color → DB level string", () => {
  it("RED → 'critical'", () => expect(mapNeedStatusToNeedLevel("RED")).toBe("critical"));
  it("ORANGE → 'high'", () => expect(mapNeedStatusToNeedLevel("ORANGE")).toBe("high"));
  it("YELLOW → 'medium'", () => expect(mapNeedStatusToNeedLevel("YELLOW")).toBe("medium"));
  it("GREEN → 'low'", () => expect(mapNeedStatusToNeedLevel("GREEN")).toBe("low"));
  it("WHITE → 'low'", () => expect(mapNeedStatusToNeedLevel("WHITE")).toBe("low"));
});

// ─── Step 4: DB level → display color (adjustStatusForCoverage) ───────────────
//
//   THIS IS WHERE THE BUG WAS.
//   mapNeedLevelToGapState("high") used to return "critical" (RED).
//   Now it returns "partial" (ORANGE).

describe("Step 4: DB level → display color (the integration fix)", () => {
  it("'critical' without deployments → RED", () => {
    expect(adjustStatusForCoverage("critical", 0).needStatus).toBe("RED");
  });

  it("'high' without deployments → ORANGE (was RED before fix!)", () => {
    // Before: mapNeedLevelToGapState("high") → "critical" → RED  ❌
    // After:  mapNeedLevelToGapState("high") → "partial"  → ORANGE ✅
    expect(adjustStatusForCoverage("high", 0).needStatus).toBe("ORANGE");
  });

  it("'medium' without deployments → ORANGE", () => {
    expect(adjustStatusForCoverage("medium", 0).needStatus).toBe("ORANGE");
  });

  it("'low' without deployments → GREEN", () => {
    expect(adjustStatusForCoverage("low", 0).needStatus).toBe("GREEN");
  });

  it("'critical' WITH deployments → ORANGE (improves from RED)", () => {
    expect(adjustStatusForCoverage("critical", 1).needStatus).toBe("ORANGE");
  });

  it("'medium' WITH deployments → YELLOW (improves from ORANGE)", () => {
    expect(adjustStatusForCoverage("medium", 1).needStatus).toBe("YELLOW");
  });
});

// ─── Full round-trip: Engine → DB → Display ──────────────────────────────────

describe("Full round-trip: engine color survives DB storage", () => {
  it("ORANGE → 'high' → ORANGE (not RED) — the exact bug that was fixed", () => {
    const engineOutput: NeedStatus = "ORANGE";
    const dbLevel = mapNeedStatusToNeedLevel(engineOutput);
    expect(dbLevel).toBe("high");
    const { needStatus: displayColor } = adjustStatusForCoverage(dbLevel, 0);
    expect(displayColor).toBe("ORANGE");
  });

  it("RED → 'critical' → RED (unchanged)", () => {
    const dbLevel = mapNeedStatusToNeedLevel("RED");
    const { needStatus } = adjustStatusForCoverage(dbLevel, 0);
    expect(needStatus).toBe("RED");
  });

  it("GREEN → 'low' → GREEN (unchanged)", () => {
    const dbLevel = mapNeedStatusToNeedLevel("GREEN");
    const { needStatus } = adjustStatusForCoverage(dbLevel, 0);
    expect(needStatus).toBe("GREEN");
  });
});

// ─── The exact bug report scenario ──────────────────────────────────────────

describe("Bug report: positive signal to ORANGE emergency medical care", () => {
  it("ORANGE need + positive signal → does NOT escalate to RED", async () => {
    // 1. Establish ORANGE: insufficiency + coverage
    const sec = "scenario-sec";
    const cap = "scenario-cap";
    const evt = "scenario-evt";

    const t1 = "2026-02-16T12:00:00.000Z";
    await needSignalService.evaluateGapNeed({
      eventId: evt, sectorId: sec, capabilityId: cap,
      signals: [{
        id: "sc-insuff", event_id: evt, sector_id: sec, capacity_type_id: cap,
        signal_type: "field_report" as SignalType, level: "sector",
        content: "recurso necesario, no alcanza, insuficiente",
        source: "ngo", confidence: 1.0, created_at: t1,
      }],
      nowIso: t1,
    });

    const t2 = "2026-02-16T12:01:00.000Z";
    const orange = await needSignalService.evaluateGapNeed({
      eventId: evt, sectorId: sec, capabilityId: cap,
      signals: [{
        id: "sc-cov", event_id: evt, sector_id: sec, capacity_type_id: cap,
        signal_type: "field_report" as SignalType, level: "sector",
        content: "despacho en ruta, refuerzo en camino",
        source: "ngo", confidence: 1.0, created_at: t2,
      }],
      nowIso: t2,
    });
    expect(orange!.current_status).toBe("ORANGE");

    // 2. NGO sends positive signal
    const t3 = "2026-02-16T12:05:00.000Z";
    const afterPositive = await needSignalService.evaluateGapNeed({
      eventId: evt, sectorId: sec, capabilityId: cap,
      signals: [{
        id: "sc-positive", event_id: evt, sector_id: sec, capacity_type_id: cap,
        signal_type: "field_report" as SignalType, level: "sector",
        content: "medical care: recurso disponible, operando estable",
        source: "ngo", confidence: 1.0, created_at: t3,
      }],
      nowIso: t3,
    });

    // 3. Engine should NOT output RED
    expect(afterPositive!.current_status).not.toBe("RED");

    // 4. DB round-trip should also NOT produce RED
    const dbLevel = mapNeedStatusToNeedLevel(afterPositive!.current_status);
    const { needStatus: display } = adjustStatusForCoverage(dbLevel, 0);
    expect(display).not.toBe("RED");
  });
});

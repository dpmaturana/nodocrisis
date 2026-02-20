/**
 * process-field-report-signals
 *
 * Canonical engine path for updating sector_needs_context from a completed
 * field report. This function runs the NeedLevelEngine logic inline (Deno-
 * compatible, no @/ alias imports) so that ALL need-level decisions come from
 * the same rule-based evaluator and guardrails — never from the old
 * deriveNeedLevel helper.
 *
 * Called by extract-text-report and transcribe-field-report after they have
 * created signals in the `signals` table.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ---------------------------------------------------------------------------
// Inline NeedLevelEngine core (adapted from src/lib/needLevelEngine.ts and
// src/services/needSignalService.ts — kept Deno-compatible, no @/ imports)
// ---------------------------------------------------------------------------

type NeedStatus = "WHITE" | "RED" | "YELLOW" | "ORANGE" | "GREEN";
type NeedLevel = "low" | "medium" | "high" | "critical";

// Source weight for field-report signals (NGO tier, same as needLevelEngine config)
const SOURCE_WEIGHT = 1.0;

// Thresholds (mirror defaultNeedEngineConfig in needLevelEngine.ts)
const THRESHOLDS = {
  demandEscalation: 1,
  insufficiencyEscalation: 0.9,
  stabilizationDowngrade: 1.8,
  fragilityReactivation: 0.9,
  coverageActivation: 0.9,
};

interface ExtractedItem {
  name: string;
  quantity: number | null;
  unit: string;
  /** English states as produced by the LLM extraction prompt */
  state: string;
  /** English urgency levels as produced by the LLM extraction prompt */
  urgency: string;
}

interface ExtractedData {
  sector_mentioned: string | null;
  capability_types: string[];
  items: ExtractedItem[];
  location_detail: string | null;
  observations: string | null;
  evidence_quotes: string[];
  confidence: number;
}

/**
 * Map an English item state to signal content that contains the Spanish
 * keywords expected by classifyContent / mapSignalType.
 * Mirrors fieldReportItemToSignalContent from needSignalService.ts but for
 * the English state values that the edge-function LLM produces.
 */
function itemToSignalContent(name: string, state: string): string {
  switch (state) {
    case "available":   return `${name}: recurso disponible, operando estable`;
    case "needed":      return `${name}: recurso necesario, no alcanza, insuficiente`;
    case "in_transit":  return `${name}: recurso en camino, despacho en ruta`;
    case "depleted":    return `${name}: recurso agotado, sin stock, saturado`;
    default:            return `${name}: estado reportado`;
  }
}

/**
 * Map an English item urgency to a confidence value.
 * Mirrors fieldReportItemToConfidence from needSignalService.ts but for
 * the English urgency values that the edge-function LLM produces.
 */
function itemToConfidence(state: string, urgency: string): number {
  if (state === "available") {
    switch (urgency) {
      case "low":      return 1.0;
      case "medium":   return 0.8;
      case "high":     return 0.5;
      case "critical": return 0.3;
      default:         return 0.6;
    }
  }
  switch (urgency) {
    case "low":      return 0.3;
    case "medium":   return 0.6;
    case "high":     return 0.8;
    case "critical": return 1.0;
    default:         return 0.5;
  }
}

/**
 * Classify signal content into a signal type using the same Spanish-keyword
 * patterns as LegacySignalExtractor / mapSignalType in needSignalService.ts.
 */
function classifyContent(content: string): string {
  if (/fragil|riesgo|colapso|inestable/i.test(content)) return "FRAGILITY_ALERT";
  if (/no alcanza|insuficiente|saturado|sin/i.test(content))  return "INSUFFICIENCY";
  if (/operando|estable|normaliz|restablec/i.test(content))   return "STABILIZATION";
  if (/llega|despacho|en camino|refuerzo/i.test(content))     return "COVERAGE_ACTIVITY";
  return "INSUFFICIENCY";
}

/**
 * Aggregate signals, evaluate booleans, and apply the RuleBasedNeedEvaluator
 * guardrails (all faithfully reproduced from NeedLevelEngine + evaluator in
 * src/lib/needLevelEngine.ts and src/services/needSignalService.ts).
 *
 * Returns the proposed NeedStatus for the capability.
 */
function evaluateNeedStatus(signals: Array<{ content: string; confidence: number }>): NeedStatus {
  let demand = 0, insuff = 0, stab = 0, frag = 0, coverage = 0;

  for (const sig of signals) {
    const delta = sig.confidence * SOURCE_WEIGHT;
    switch (classifyContent(sig.content)) {
      case "INSUFFICIENCY":     insuff += delta;   break;
      case "STABILIZATION":     stab += delta;     break;
      case "FRAGILITY_ALERT":   frag += delta;     break;
      case "COVERAGE_ACTIVITY": coverage += delta; break;
      default:                  demand += delta;   break;
    }
  }

  const demandStrong       = demand   >= THRESHOLDS.demandEscalation;
  const insuffStrong       = insuff   >= THRESHOLDS.insufficiencyEscalation;
  const stabilizationStrong = stab   >= THRESHOLDS.stabilizationDowngrade;
  const fragilityAlert     = frag    >= THRESHOLDS.fragilityReactivation;
  const coverageActive     = coverage >= THRESHOLDS.coverageActivation;

  // RuleBasedNeedEvaluator (from needSignalService.ts)
  let proposed: NeedStatus = "WHITE";
  if (demandStrong && !coverageActive) {
    proposed = "RED";
  } else if (insuffStrong && coverageActive) {
    proposed = "ORANGE";
  } else if (stabilizationStrong && !fragilityAlert && !demandStrong && !insuffStrong) {
    proposed = "GREEN";
  } else if (coverageActive) {
    proposed = "YELLOW";
  }

  // Guardrail A: RED floor when demand strong and no coverage
  if (demandStrong && !coverageActive) {
    proposed = "RED";
  }

  // Guardrail B: insufficiency without coverage → RED
  if (insuffStrong && !coverageActive && proposed !== "RED") {
    proposed = "RED";
  }

  return proposed;
}

/** Mirror of mapNeedStatusToNeedLevel in needSignalService.ts */
function mapStatusToNeedLevel(status: NeedStatus): NeedLevel {
  switch (status) {
    case "RED":    return "critical";
    case "ORANGE": return "high";
    case "YELLOW": return "medium";
    case "GREEN":  return "low";
    case "WHITE":  return "low";
    default:       return "medium";
  }
}

/** Numeric ranking for need levels – higher is more severe. */
const LEVEL_RANK: Record<string, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

/** Return the more severe of two need levels. */
function higherLevel(a: NeedLevel, b: NeedLevel): NeedLevel {
  return (LEVEL_RANK[a] ?? 0) >= (LEVEL_RANK[b] ?? 0) ? a : b;
}

/** Map an item urgency string to a NeedLevel (same vocabulary). */
function urgencyToLevel(urgency: string): NeedLevel {
  switch (urgency) {
    case "critical": return "critical";
    case "high":     return "high";
    case "medium":   return "medium";
    case "low":      return "low";
    default:         return "low";
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      event_id,
      sector_id,
      extracted_data,
      capacity_type_map,
      report_id,
    }: {
      event_id: string;
      sector_id: string;
      extracted_data: ExtractedData;
      capacity_type_map: Record<string, string>;
      report_id?: string;
    } = await req.json();

    if (!event_id || !sector_id || !extracted_data || !capacity_type_map) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: event_id, sector_id, extracted_data, capacity_type_map",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(
      `[NeedLevelEngine] Processing field report signals — event: ${event_id}, sector: ${sector_id}, report: ${report_id ?? "inline"}`,
    );

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const items: ExtractedItem[] = extracted_data.items ?? [];
    const capabilityNames: string[] = extracted_data.capability_types ?? [];

    // Group items by capability type id using the same matching logic as
    // needSignalService.onFieldReportCompleted (src/services/needSignalService.ts).
    // The asymmetric substring check is intentional: it mirrors the existing
    // service so that the edge function and the service agree on item attribution.
    const itemsByCapId = new Map<string, ExtractedItem[]>();

    for (const item of items) {
      for (const [capName, capId] of Object.entries(capacity_type_map)) {
        const capLower = capName.toLowerCase();
        const itemLower = item.name.toLowerCase();
        if (capLower.includes(itemLower) || itemLower.includes(capLower.split(" ")[0])) {
          if (!itemsByCapId.has(capId)) itemsByCapId.set(capId, []);
          itemsByCapId.get(capId)!.push(item);
        }
      }
    }

    // Ensure capability_types explicitly listed in extractedData are represented
    // even when no items matched them. They are only added when absent so that
    // item-matched capabilities are not overwritten with empty arrays.
    // (Mirrors the same pattern in needSignalService.onFieldReportCompleted.)
    // NOTE: capabilities added here with no items will be skipped below when
    // signals.length === 0, which is the correct/intended behaviour.
    for (const capName of capabilityNames) {
      const capId = capacity_type_map[capName];
      if (capId && !itemsByCapId.has(capId)) {
        itemsByCapId.set(capId, []);
      }
    }

    const results: Array<{ capabilityId: string; status: NeedStatus; needLevel: NeedLevel }> = [];

    for (const [capId, capItems] of itemsByCapId) {
      const signals = capItems.map((item) => ({
        content:    itemToSignalContent(item.name, item.state),
        confidence: itemToConfidence(item.state, item.urgency),
      }));

      // Skip capabilities with no signals (no items matched)
      if (signals.length === 0) continue;

      const status    = evaluateNeedStatus(signals);
      let needLevel = mapStatusToNeedLevel(status);

      // Escalation: check max item urgency and promote needLevel if higher
      for (const item of capItems) {
        const itemLevel = urgencyToLevel(item.urgency);
        needLevel = higherLevel(needLevel, itemLevel);
      }

      // Never downgrade: query current level and keep whichever is higher
      const { data: currentRow } = await supabase
        .from("sector_needs_context")
        .select("level")
        .eq("event_id", event_id)
        .eq("sector_id", sector_id)
        .eq("capacity_type_id", capId)
        .maybeSingle();

      if (currentRow?.level) {
        needLevel = higherLevel(needLevel, currentRow.level as NeedLevel);
      }

      console.log(
        `[NeedLevelEngine] capability=${capId} engine_status=${status} need_level=${needLevel}`,
      );

      // Upsert sector_needs_context based on engine decision — NOT deriveNeedLevel
      const { error: upsertError } = await supabase
        .from("sector_needs_context")
        .upsert(
          {
            event_id,
            sector_id,
            capacity_type_id: capId,
            level: needLevel,
            source: "field_report",
            notes: extracted_data.observations ?? null,
            created_by: null,
            expires_at: null,
          },
          { onConflict: "event_id,sector_id,capacity_type_id" },
        );

      if (upsertError) {
        console.error(
          `[NeedLevelEngine] sector_needs_context upsert error for capability=${capId}:`,
          upsertError,
        );
      } else {
        console.log(
          `[NeedLevelEngine] sector_needs_context updated: capability=${capId} level=${needLevel}`,
        );
      }

      results.push({ capabilityId: capId, status, needLevel });
    }

    console.log(
      `[NeedLevelEngine] Done — ${results.length} capability(ies) processed via engine path`,
    );

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("[NeedLevelEngine] Error in process-field-report-signals:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

/**
 * process-field-report-signals
 *
 * Canonical engine path for updating sector_needs_context from a completed
 * field report. Evaluation logic is imported from _shared/evaluateNeedStatus.ts
 * so that all edge functions use the same single source of truth.
 *
 * Called by extract-text-report and transcribe-field-report after they have
 * created signals in the `signals` table.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  mapNeedStatusToNeedLevel as mapStatusToNeedLevel,
  mapNeedLevelToAuditStatus,
  type NeedStatus,
  type NeedLevel,
} from "../_shared/evaluateNeedStatus.ts";
import { evaluateNeedStatusWithLLM } from "../_shared/evaluateNeedStatusWithLLM.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
 * Map an English item state to signal content for display/logging purposes
 * (used when creating signal records in the `signals` table).
 * This is NOT used for scoring — see classifyItemState() for the scoring path.
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
 * Quick keyword-based classification of observation text.
 * Returns a synthetic signal when stabilization or insufficiency keywords are detected.
 * This avoids an LLM call for obvious cases like "no injuries reported".
 */
function classifyObservationText(text: string): { state: string; confidence: number } | null {
  const stabPatterns = /\b(stable|sufficient|resolved|available|okay|ok|covered|healthy|no\s*(injury|injuries|emergency|need|shortage|damage)|recovering|good|operational|functioning|normal|restored|safe)\b/i;
  const insuffPatterns = /\b(needed|insufficient|depleted|shortage|lacking|overwhelmed|critical|scarce|exhausted|saturated|collapsed|unavailable|emergency)\b/i;

  if (stabPatterns.test(text)) {
    return { state: "available", confidence: 0.85 };
  }
  if (insuffPatterns.test(text)) {
    return { state: "needed", confidence: 0.7 };
  }
  return null;
}

interface ObservationScoreProposal {
  raw_observation: string;
  proposed_scores: {
    demand: number;
    insufficiency: number;
    stabilization: number;
    fragility: number;
    coverage: number;
  };
  confidence: number;
  model: string;
}

/**
 * Call the LLM to propose engine scores from a free-text observation.
 * Returns null on any failure; callers should fall back to a conservative
 * "needed" signal at low confidence.
 */
async function proposeScoresFromObservation(
  observations: string,
  lovableApiKey: string,
): Promise<ObservationScoreProposal | null> {
  const systemPrompt = `You are a humanitarian crisis signal scoring assistant.
Given a field observation text, score the following dimensions from 0.0 to 1.0.
Return ONLY valid JSON, no markdown.

{
  "demand": number,          // evidence of new unmet needs emerging
  "insufficiency": number,   // evidence that resources are insufficient or depleted
  "stabilization": number,   // evidence that situation is stable, improving, or resolved
  "fragility": number,       // evidence of fragile or at-risk stability (could worsen)
  "coverage": number,        // evidence of active resource deployment or NGO presence
  "confidence": number       // your confidence in these scores (0.0-1.0)
}`;

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
          { role: "user", content: observations },
        ],
        temperature: 0.1,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      console.warn(`[NeedLevelEngine] proposeScoresFromObservation HTTP error: ${response.status}`);
      return null;
    }

    const result = await response.json();
    const content: string = result.choices?.[0]?.message?.content ?? "";

    let jsonStr = content;
    if (jsonStr.includes("```")) {
      jsonStr = jsonStr.replace(/```json?\n?/g, "").replace(/```/g, "");
    }

    const parsed = JSON.parse(jsonStr.trim());

    return {
      raw_observation: observations,
      proposed_scores: {
        demand:        Math.min(1, Math.max(0, Number(parsed.demand        ?? 0))),
        insufficiency: Math.min(1, Math.max(0, Number(parsed.insufficiency ?? 0))),
        stabilization: Math.min(1, Math.max(0, Number(parsed.stabilization ?? 0))),
        fragility:     Math.min(1, Math.max(0, Number(parsed.fragility     ?? 0))),
        coverage:      Math.min(1, Math.max(0, Number(parsed.coverage      ?? 0))),
      },
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence ?? 0.5))),
      model: "google/gemini-2.5-flash",
    };
  } catch (err) {
    console.warn("[NeedLevelEngine] proposeScoresFromObservation error:", err);
    return null;
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
    // even when no items matched them. Assign ALL unmatched items to these
    // capabilities so the engine can still evaluate need levels.
    for (const capName of capabilityNames) {
      const capId = capacity_type_map[capName];
      if (capId && !itemsByCapId.has(capId)) {
        // Assign all items to this capability as a fallback — the LLM
        // explicitly listed this capability, so the items likely relate to it
        // even if substring matching failed.
        itemsByCapId.set(capId, items.length > 0 ? [...items] : []);
      }
    }

    // Build set of capability IDs that were explicitly named in extracted_data.capability_types
    // (used to determine whether to generate a synthetic signal for item-less capabilities)
    const explicitCapIds = new Set<string>();
    for (const capName of capabilityNames) {
      const capId = capacity_type_map[capName];
      if (capId) explicitCapIds.add(capId);
    }

    const results: Array<{ capabilityId: string; status: NeedStatus; needLevel: NeedLevel }> = [];

    for (const [capId, capItems] of itemsByCapId) {
      const signals = capItems.map((item) => ({
        state:      item.state,
        confidence: itemToConfidence(item.state, item.urgency),
      }));

      // Collect operational requirements (bottleneck notes) for needed/depleted items
      const operationalRequirements: string[] = capItems
        .filter((item) => item.state === "needed" || item.state === "depleted")
        .map((item) =>
          `${item.name}${item.urgency !== "low" ? ` (${item.urgency})` : ""}`
        );

      // When no items matched but the capability was explicitly named,
      // call the LLM to propose engine scores from the observation text.
      let scoreProposal: ObservationScoreProposal | null = null;

      if (signals.length === 0) {
        if (!explicitCapIds.has(capId)) continue;
        const obs = extracted_data.observations;
        if (!obs) continue;

        // First try quick keyword classification before calling the LLM
        const quickClass = classifyObservationText(obs);
        if (quickClass) {
          signals.push(quickClass);
          console.log(`[NeedLevelEngine] Quick-classified observation for capability=${capId}: state=${quickClass.state} confidence=${quickClass.confidence}`);
        }

        // If quick classification didn't produce a signal, try LLM
        if (signals.length === 0) {
          const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

          if (lovableApiKey) {
            scoreProposal = await proposeScoresFromObservation(obs, lovableApiKey);
          }
        }

        if (scoreProposal) {
          console.log(`[NeedLevelEngine] LLM score proposal for capability=${capId}: ${JSON.stringify(scoreProposal)}`);
          if (scoreProposal.proposed_scores.stabilization * scoreProposal.confidence > 0.01) {
            signals.push({ state: "available", confidence: scoreProposal.proposed_scores.stabilization * scoreProposal.confidence });
          }
          if (scoreProposal.proposed_scores.insufficiency * scoreProposal.confidence > 0.01) {
            signals.push({ state: "needed", confidence: scoreProposal.proposed_scores.insufficiency * scoreProposal.confidence });
          }
          if (scoreProposal.proposed_scores.demand * scoreProposal.confidence > 0.01) {
            signals.push({ state: "needed", confidence: scoreProposal.proposed_scores.demand * scoreProposal.confidence });
          }
          if (scoreProposal.proposed_scores.coverage * scoreProposal.confidence > 0.01) {
            signals.push({ state: "in_transit", confidence: scoreProposal.proposed_scores.coverage * scoreProposal.confidence });
          }
          if (scoreProposal.proposed_scores.fragility * scoreProposal.confidence > 0.01) {
            signals.push({ state: "fragility", confidence: scoreProposal.proposed_scores.fragility * scoreProposal.confidence });
          }
        } else {
          console.warn(`[NeedLevelEngine] LLM score proposal failed for capability=${capId}, using fallback needed signal`);
          // Fallback: conservative "needed" signal at low confidence
          signals.push({ state: "needed", confidence: 0.3 });
        }
      }

      // Read existing need level BEFORE evaluating, so it can inform guardrails
      const { data: existingNeed } = await supabase
        .from("sector_needs_context")
        .select("level")
        .eq("event_id", event_id)
        .eq("sector_id", sector_id)
        .eq("capacity_type_id", capId)
        .maybeSingle();

      const previousNeedLevel = existingNeed?.level ?? "medium";
      const previousStatus = mapNeedLevelToAuditStatus(previousNeedLevel);

      const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
      const {
        status,
        scores,
        booleans,
        guardrailsApplied,
        legalTransition,
        llm_confidence,
        reasoning_summary,
        contradiction_detected,
        key_evidence,
        model,
      } = await evaluateNeedStatusWithLLM(signals, previousStatus, {
        lovableApiKey,
        evidenceQuotes: extracted_data.evidence_quotes,
        observations: extracted_data.observations,
      });
      const needLevel = mapStatusToNeedLevel(status);

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
            notes: JSON.stringify({
              requirements: operationalRequirements.length > 0
                ? operationalRequirements
                : [],
              description: extracted_data.observations ?? null,
            }),
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

      // Persist engine reasoning to need_audits — non-blocking on error
      const { error: auditError } = await supabase.from("need_audits").insert({
        sector_id,
        capability_id: capId,
        event_id,
        timestamp: new Date().toISOString(),
        previous_status: mapNeedLevelToAuditStatus(previousNeedLevel),
        proposed_status: status,
        final_status: status,
        llm_confidence,
        reasoning_summary,
        contradiction_detected,
        key_evidence,
        legal_transition: legalTransition,
        guardrails_applied: guardrailsApplied,
        scores_snapshot: scores,
        booleans_snapshot: booleans,
        model,
        prompt_version: "v1",
        observation_score_proposal: scoreProposal ?? null,
      });

      if (auditError) {
        console.error(
          `[NeedLevelEngine] need_audits insert error for capability=${capId}:`,
          auditError,
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

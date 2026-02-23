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
  state: string;
  urgency: string;
}

interface CapabilityExtraction {
  name: string;
  sentiment: "improving" | "worsening" | "stable" | "unknown";
  items: ExtractedItem[];
  observation: string;
  evidence_quotes: string[];
}

interface ExtractedData {
  // New per-capability format
  capabilities?: CapabilityExtraction[];
  // Legacy flat format
  sector_mentioned: string | null;
  capability_types: string[];
  items: ExtractedItem[];
  location_detail: string | null;
  observations: string | null;
  evidence_quotes: string[];
  confidence: number;
}

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

async function proposeScoresFromObservation(
  observations: string,
  lovableApiKey: string,
): Promise<ObservationScoreProposal | null> {
  const systemPrompt = `You are a humanitarian crisis signal scoring assistant.
Given a field observation text, score the following dimensions from 0.0 to 1.0.
Return ONLY valid JSON, no markdown.

{
  "demand": number,
  "insufficiency": number,
  "stabilization": number,
  "fragility": number,
  "coverage": number,
  "confidence": number
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
// Per-capability processing (new path)
// ---------------------------------------------------------------------------

async function processCapability(
  cap: CapabilityExtraction,
  capId: string,
  event_id: string,
  sector_id: string,
  supabase: any,
  lovableApiKey: string | undefined,
): Promise<{ capabilityId: string; status: NeedStatus; needLevel: NeedLevel } | null> {
  const signals: Array<{ state: string; confidence: number }> = [];
  let scoreProposal: ObservationScoreProposal | null = null;

  // Build signals from capability-specific items
  for (const item of (cap.items || [])) {
    signals.push({
      state: item.state,
      confidence: itemToConfidence(item.state, item.urgency),
    });
  }

  // If no items, use capability-specific observation
  if (signals.length === 0 && cap.observation) {
    const quickClass = classifyObservationText(cap.observation);
    if (quickClass) {
      signals.push(quickClass);
      console.log(`[NeedLevelEngine][per-cap] Quick-classified "${cap.name}": state=${quickClass.state}`);
    }

    if (signals.length === 0 && lovableApiKey) {
      scoreProposal = await proposeScoresFromObservation(cap.observation, lovableApiKey);
      if (scoreProposal) {
        console.log(`[NeedLevelEngine][per-cap] LLM score proposal for "${cap.name}": ${JSON.stringify(scoreProposal)}`);
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
        signals.push({ state: "needed", confidence: 0.3 });
      }
    }

    if (signals.length === 0) {
      signals.push({ state: "needed", confidence: 0.3 });
    }
  }

  if (signals.length === 0) return null;

  // Read existing need level
  const { data: existingNeed } = await supabase
    .from("sector_needs_context")
    .select("level")
    .eq("event_id", event_id)
    .eq("sector_id", sector_id)
    .eq("capacity_type_id", capId)
    .maybeSingle();

  const previousNeedLevel = existingNeed?.level ?? "medium";
  const previousStatus = mapNeedLevelToAuditStatus(previousNeedLevel);

  // Pass capability-specific observation and evidence to the LLM evaluator
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
    llm_error,
  } = await evaluateNeedStatusWithLLM(signals, previousStatus, {
    lovableApiKey,
    evidenceQuotes: cap.evidence_quotes || [],
    observations: cap.observation || null,
  });
  const needLevel = mapStatusToNeedLevel(status);

  console.log(`[NeedLevelEngine][per-cap] "${cap.name}" (${capId}) → status=${status} level=${needLevel}`);

  // Collect operational requirements
  const operationalRequirements = (cap.items || [])
    .filter((item) => item.state === "needed" || item.state === "depleted")
    .map((item) => `${item.name}${item.urgency !== "low" ? ` (${item.urgency})` : ""}`);

  // Upsert sector_needs_context
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
          requirements: operationalRequirements,
          description: cap.observation || null,
        }),
        created_by: null,
        expires_at: null,
      },
      { onConflict: "event_id,sector_id,capacity_type_id" },
    );

  if (upsertError) {
    console.error(`[NeedLevelEngine][per-cap] upsert error for "${cap.name}":`, upsertError);
  }

  // Persist audit
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
    prompt_version: "v2-per-capability",
    observation_score_proposal: scoreProposal ?? null,
    llm_error: llm_error ?? null,
  });

  if (auditError) {
    console.error(`[NeedLevelEngine][per-cap] audit error for "${cap.name}":`, auditError);
  }

  return { capabilityId: capId, status, needLevel };
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

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const results: Array<{ capabilityId: string; status: NeedStatus; needLevel: NeedLevel }> = [];

    // -----------------------------------------------------------------------
    // NEW PATH: per-capability processing
    // -----------------------------------------------------------------------
    if (Array.isArray(extracted_data.capabilities) && extracted_data.capabilities.length > 0) {
      console.log(`[NeedLevelEngine] Using per-capability path (${extracted_data.capabilities.length} capabilities)`);

      for (const cap of extracted_data.capabilities) {
        const capId = capacity_type_map[cap.name];
        if (!capId) {
          console.warn(`[NeedLevelEngine][per-cap] Unknown capability name: "${cap.name}", skipping`);
          continue;
        }

        const result = await processCapability(cap, capId, event_id, sector_id, supabase, lovableApiKey);
        if (result) results.push(result);
      }

      console.log(`[NeedLevelEngine] Done (per-cap) — ${results.length} capability(ies) processed`);

      return new Response(
        JSON.stringify({ success: true, results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // -----------------------------------------------------------------------
    // LEGACY PATH: flat extraction format (backward compatibility)
    // -----------------------------------------------------------------------
    console.log("[NeedLevelEngine] Using legacy flat path");

    const items: ExtractedItem[] = extracted_data.items ?? [];
    const capabilityNames: string[] = extracted_data.capability_types ?? [];

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

    for (const capName of capabilityNames) {
      const capId = capacity_type_map[capName];
      if (capId && !itemsByCapId.has(capId)) {
        itemsByCapId.set(capId, items.length > 0 ? [...items] : []);
      }
    }

    const explicitCapIds = new Set<string>();
    for (const capName of capabilityNames) {
      const capId = capacity_type_map[capName];
      if (capId) explicitCapIds.add(capId);
    }

    for (const [capId, capItems] of itemsByCapId) {
      const signals = capItems.map((item) => ({
        state:      item.state,
        confidence: itemToConfidence(item.state, item.urgency),
      }));

      const operationalRequirements: string[] = capItems
        .filter((item) => item.state === "needed" || item.state === "depleted")
        .map((item) =>
          `${item.name}${item.urgency !== "low" ? ` (${item.urgency})` : ""}`
        );

      let scoreProposal: ObservationScoreProposal | null = null;

      if (signals.length === 0) {
        if (!explicitCapIds.has(capId)) continue;
        const obs = extracted_data.observations;
        if (!obs) continue;

        const quickClass = classifyObservationText(obs);
        if (quickClass) {
          signals.push(quickClass);
        }

        if (signals.length === 0) {
          if (lovableApiKey) {
            scoreProposal = await proposeScoresFromObservation(obs, lovableApiKey);
          }
        }

        if (scoreProposal) {
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
          signals.push({ state: "needed", confidence: 0.3 });
        }
      }

      const { data: existingNeed } = await supabase
        .from("sector_needs_context")
        .select("level")
        .eq("event_id", event_id)
        .eq("sector_id", sector_id)
        .eq("capacity_type_id", capId)
        .maybeSingle();

      const previousNeedLevel = existingNeed?.level ?? "medium";
      const previousStatus = mapNeedLevelToAuditStatus(previousNeedLevel);

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
        llm_error,
      } = await evaluateNeedStatusWithLLM(signals, previousStatus, {
        lovableApiKey,
        evidenceQuotes: extracted_data.evidence_quotes,
        observations: extracted_data.observations,
      });
      const needLevel = mapStatusToNeedLevel(status);

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
              requirements: operationalRequirements.length > 0 ? operationalRequirements : [],
              description: extracted_data.observations ?? null,
            }),
            created_by: null,
            expires_at: null,
          },
          { onConflict: "event_id,sector_id,capacity_type_id" },
        );

      if (upsertError) {
        console.error(`[NeedLevelEngine] upsert error for capability=${capId}:`, upsertError);
      }

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
        llm_error: llm_error ?? null,
      });

      if (auditError) {
        console.error(`[NeedLevelEngine] audit error for capability=${capId}:`, auditError);
      }

      results.push({ capabilityId: capId, status, needLevel });
    }

    console.log(`[NeedLevelEngine] Done (legacy) — ${results.length} capability(ies) processed`);

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

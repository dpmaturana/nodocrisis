/**
 * evaluate-need
 *
 * HTTP endpoint that exposes the shared rule-based need evaluation logic to
 * the frontend. The frontend calls this instead of running the evaluation
 * logic locally, ensuring a single source of truth for all status decisions.
 *
 * POST /functions/v1/evaluate-need
 * Body: {
 *   event_id: string,
 *   sector_id: string,
 *   capacity_type_id: string,
 *   signals: Array<{ state: string; confidence: number }>,
 *   previousStatus?: NeedStatus,
 * }
 * Response: {
 *   status: NeedStatus,
 *   needLevel: NeedLevel,
 *   reasoning: string,
 *   scores: { demand: number; insuff: number; stab: number; frag: number; coverage: number },
 *   guardrails: string[],
 * }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  evaluateNeedStatus,
  buildHumanReasoning,
  mapNeedStatusToNeedLevel,
  mapNeedLevelToAuditStatus,
  type NeedStatus,
} from "../_shared/evaluateNeedStatus.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      event_id,
      sector_id,
      capacity_type_id,
      signals,
      previousStatus,
    }: {
      event_id: string;
      sector_id: string;
      capacity_type_id: string;
      signals: Array<{ state: string; confidence: number }>;
      previousStatus?: NeedStatus;
    } = await req.json();

    if (!event_id || !sector_id || !capacity_type_id || !Array.isArray(signals)) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: event_id, sector_id, capacity_type_id, signals",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { status, scores, booleans, guardrailsApplied, legalTransition } = evaluateNeedStatus(signals, previousStatus ?? undefined);
    const needLevel = mapNeedStatusToNeedLevel(status);
    const reasoning = buildHumanReasoning(scores, booleans, status, guardrailsApplied);

    // Persist result to sector_needs_context
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { error: upsertError } = await supabase
      .from("sector_needs_context")
      .upsert(
        {
          event_id,
          sector_id,
          capacity_type_id,
          level: needLevel,
          source: "evaluate_need",
          created_by: null,
          expires_at: null,
        },
        { onConflict: "event_id,sector_id,capacity_type_id" },
      );

    if (upsertError) {
      console.error("[evaluate-need] sector_needs_context upsert error:", upsertError);
    }

    // Persist audit trail
    const previousNeedStatus: NeedStatus = previousStatus ?? "WHITE";
    const { error: auditError } = await supabase.from("need_audits").insert({
      sector_id,
      capability_id: capacity_type_id,
      event_id,
      timestamp: new Date().toISOString(),
      previous_status: previousNeedStatus,
      proposed_status: status,
      final_status: status,
      llm_confidence: 0,
      reasoning_summary: reasoning,
      contradiction_detected: false,
      key_evidence: [],
      legal_transition: legalTransition,
      guardrails_applied: guardrailsApplied,
      scores_snapshot: scores,
      booleans_snapshot: booleans,
      model: "rule-based-engine",
      prompt_version: "v1",
    });

    if (auditError) {
      console.error("[evaluate-need] need_audits insert error:", auditError);
    }

    return new Response(
      JSON.stringify({
        status,
        needLevel,
        reasoning,
        scores,
        guardrails: guardrailsApplied,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("[evaluate-need] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SuggestedSector = {
  name: string;
  description: string;
  latitude: number | null;
  longitude: number | null;
  confidence: number;
  include: boolean;
};

type SuggestedCapability = {
  capability_name: string;
  confidence: number;
  include: boolean;
};

type SituationReportResponse = {
  event_name_suggested: string;
  event_type: string;
  summary: string;
  suggested_sectors: SuggestedSector[];
  suggested_capabilities: SuggestedCapability[];
  sources: any[]; // we'll store full news snippets + metadata
  overall_confidence: number;
};

// This prompt creates the "draft suggestions" (sectors + capabilities) based on admin input + news context.
// Keep it simple and strict: JSON only.
const SYSTEM_PROMPT = `You are an emergency coordination assistant for NodoCrisis.

You will receive:
1) an admin's initial incident description
2) pre-validated news snippets (already filtered for relevance — trust them)
3) a NEWS EVIDENCE STATUS section indicating how many relevant snippets were found

Your job:
- Suggest an event name, event type, and a short summary.
- Suggest operational sectors (affected zones).
- Suggest critical capabilities required at the EVENT level.
- ALL output text (event name, summary, sector names, descriptions) MUST be in ENGLISH regardless of the input language.
- If NEWS EVIDENCE STATUS says no relevant snippets were found, generate based on the admin description alone.

Return ONLY valid JSON. No markdown. No explanations.

Event types (use EXACTLY one of these values):
"incendio_forestal","inundacion","terremoto","tsunami","aluvion","sequia","temporal","accidente_masivo","emergencia_sanitaria","otro"

SECTORS RULES (CRITICAL):
- Sectors must be GRANULAR and OPERATIONALLY SPECIFIC.
- Use municipalities, named neighborhoods, specific road segments, river basins, or named infrastructure.
- NEVER use broad regions like "Southern England" or "East Coast".
- Good examples: "Somerset – River Parrett floodplain", "A303 segment km 12-18", "York – Huntington Road area", "Carlisle – Warwick Road neighbourhood"
- Bad examples: "England", "Rural areas", "Affected roads"
- If the input text or news snippets mention specific places, USE THEM.
- If no specific places are available, infer plausible municipalities/zones from the geographic context.
- Include approximate latitude and longitude for each sector if possible.

CAPABILITIES — use ONLY these exact names (from the system's standardized taxonomy):
{{CAPABILITY_LIST}}

Output schema:
{
  "event_name_suggested": string,
  "event_type": string,
  "summary": string,
  "suggested_sectors": [
    { "name": string, "description": string, "latitude": number|null, "longitude": number|null, "confidence": number, "include": boolean }
  ],
  "suggested_capabilities": [
    { "capability_name": string, "confidence": number, "include": boolean }
  ],
  "sources": string[],
  "overall_confidence": number
}

Rules:
- Be conservative. If uncertain, lower confidence.
- "include" should default to true for suggestions.
- "sources" should be short strings summarizing which snippets were used (e.g., "Sky News: <title>").
- Do not invent facts not supported by admin text + snippets.
- Suggest 3-8 sectors and 3-8 capabilities.
`;

function clamp01(n: any, fallback = 0.5) {
  const x = typeof n === "number" ? n : fallback;
  return Math.max(0, Math.min(1, x));
}

function safeArray<T>(v: any): T[] {
  return Array.isArray(v) ? v : [];
}

/**
 * Uses the LLM to detect the country and language from an incident description.
 * Returns { country_code: string, lang: string } or null on failure.
 */
async function detectLocationFromText(
  text: string,
  lovableKey: string,
): Promise<{ country_code: string; lang: string } | null> {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `You are a geographic location classifier for crisis coordination.
Given an incident description, identify the country and language.
Return ONLY valid JSON. No markdown. No explanations.
Output schema: { "country_code": string, "lang": string }
- country_code: ISO 3166-1 alpha-2 uppercase (e.g. "US", "CL", "GB", "AR", "PE", "MX")
- lang: ISO 639-1 lowercase (e.g. "en", "es", "pt", "fr")
- If no specific country is identifiable, default to "US" and "en".
Examples:
- "building collapse in Philadelphia" → { "country_code": "US", "lang": "en" }
- "terremoto en Valparaíso" → { "country_code": "CL", "lang": "es" }
- "flood in London" → { "country_code": "GB", "lang": "en" }
- "inundaciones en Buenos Aires" → { "country_code": "AR", "lang": "es" }`,
        },
        { role: "user", content: text },
      ],
      temperature: 0,
      max_tokens: 60,
    }),
  });

  if (!resp.ok) return null;

  const json = await resp.json();
  const content = json?.choices?.[0]?.message?.content ?? "";
  try {
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (typeof parsed.country_code === "string" && typeof parsed.lang === "string") {
      return {
        country_code: parsed.country_code.toUpperCase().slice(0, 2),
        lang: parsed.lang.toLowerCase().slice(0, 2),
      };
    }
    return null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ---- Auth & clients ----
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: "SUPABASE_URL / SERVICE_ROLE_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service client (DB writes, bypasses RLS)
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // User client (reads JWT from request) to identify caller
    const authHeader = req.headers.get("Authorization") || "";
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await supabaseUser.auth.getUser();
    const user = userData?.user;

    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Enforce admin role (simple check in user_roles)
    const { data: roleRow, error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleErr || !roleRow) {
      return new Response(JSON.stringify({ error: "Admin role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- Input ----
    const body = await req.json();

    const input_text =
      typeof body.input_text === "string"
        ? body.input_text
        : typeof body.query_text === "string"
          ? body.query_text
          : typeof body.query === "string"
            ? body.query
            : "";

    if (!input_text.trim()) {
      return new Response(JSON.stringify({ error: "input_text is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const max_results = typeof body.max_results === "number" ? Math.max(1, Math.min(20, body.max_results)) : 8;

    // ---- Resolve country_code and lang ----
    // If caller provides country_code, use it. Otherwise auto-detect from incident text.
    let country_code: string;
    let detected_lang: string | undefined;

    if (typeof body.country_code === "string" && body.country_code.trim().length >= 2) {
      country_code = body.country_code.toUpperCase();
      detected_lang = typeof body.lang === "string" ? body.lang.toLowerCase() : undefined;
    } else {
      // Need lovableKey for detection — check it early
      const lovableKeyForDetect = Deno.env.get("LOVABLE_API_KEY");
      if (!lovableKeyForDetect) {
        return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const detected = await detectLocationFromText(input_text, lovableKeyForDetect);
      if (!detected) {
        return new Response(
          JSON.stringify({ error: "Could not detect country from incident text. Please provide country_code explicitly." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      country_code = detected.country_code;
      detected_lang = detected.lang;
    }

    // ---- Step 1: Collect news context ----
    // Call the existing Edge Function collect-news-context
    const collectUrl = `${supabaseUrl}/functions/v1/collect-news-context`;

    const collectResp = await fetch(collectUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Use service role for internal call (no user friction)
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        country_code,
        query: input_text,
        max_results,
        summarize: true,
        ...(detected_lang ? { lang: detected_lang } : {}),
      }),
    });

    if (!collectResp.ok) {
      const t = await collectResp.text();
      return new Response(JSON.stringify({ error: "Failed to collect news context", detail: t }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const collected = await collectResp.json();
    const allSnippets = safeArray<any>(collected.news_snippets);
    const summary = collected.summary ?? null; // from anchor-rule pre-screening

    // ---- Filter snippets based on pre-screening ----
    let news_snippets: any[];
    let locationMatch: boolean | null = null;

    if (summary) {
      locationMatch = summary.location_match === true;

      if (!locationMatch) {
        // Pre-screening says snippets don't match the incident — drop all
        news_snippets = [];
      } else {
        // Keep only snippets referenced in summary.used[]
        const usedIds = new Set(
          safeArray<any>(summary.used).map((u: any) => u.id)
        );
        if (usedIds.size > 0) {
          news_snippets = allSnippets.filter((_: any, idx: number) =>
            usedIds.has(`news_${idx + 1}`)
          );
        } else {
          news_snippets = allSnippets; // used[] empty but match=true → keep all
        }
      }
    } else {
      // No summary (key missing or failure) — fall back to all snippets
      news_snippets = allSnippets;
    }

    // Build a compact "sources list" for the LLM (titles only)
    const sourcesForLLM: string[] = news_snippets.slice(0, 10).map((s: any) => {
      const src = s.source_name ?? "Unknown";
      const title = s.title ?? "";
      return `${src}: ${title}`.slice(0, 180);
    });

    // Build evidence status block for the prompt
    let evidenceStatus: string;
    if (news_snippets.length === 0) {
      evidenceStatus = `NEWS EVIDENCE STATUS:
- No relevant news snippets were found for this incident.
- Generate sectors and capabilities based on the admin description alone.`;
    } else {
      evidenceStatus = `NEWS EVIDENCE STATUS:
- Relevant snippets found: ${news_snippets.length} (out of ${allSnippets.length} collected)
- Location match: ${locationMatch ?? "unknown"}`;
    }

    const userPrompt = `ADMIN INCIDENT TEXT:
"${input_text}"

COUNTRY:
${country_code}

${evidenceStatus}

NEWS SNIPPETS (pre-validated, relevant to this incident):
${JSON.stringify(news_snippets.slice(0, 10), null, 2)}
`;

    // ---- Step 2: Fetch capabilities dynamically & call LLM ----
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch standardized capability names from DB
    const { data: capTypes } = await supabaseAdmin
      .from("capacity_types")
      .select("name");
    const capList = capTypes && capTypes.length > 0
      ? capTypes.map((c: any) => `"${c.name}"`).join(",")
      : '"Drinking water","Food supply","Shelter","Emergency medical care","Search and rescue","Communications","Transport"';

    // Inject dynamic capability list into prompt
    const finalSystemPrompt = SYSTEM_PROMPT.replace("{{CAPABILITY_LIST}}", capList);

    const llmResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: finalSystemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 2500,
      }),
    });

    if (!llmResp.ok) {
      const t = await llmResp.text();
      return new Response(JSON.stringify({ error: "LLM failed", detail: t }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const llmJson = await llmResp.json();
    const content = llmJson?.choices?.[0]?.message?.content ?? "";

    let parsed: SituationReportResponse | null = null;
    try {
      const cleaned = content
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = null;
    }

    if (!parsed) {
      return new Response(JSON.stringify({ error: "LLM returned invalid JSON", raw: content }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- Evidence-based confidence cap ----
    // Primary gate: if pre-screening said location doesn't match, hard cap at 0.40
    let confidenceCap: number;

    if (locationMatch === false || news_snippets.length === 0) {
      confidenceCap = 0.40;  // no relevant evidence for this incident
    } else {
      // Secondary: score-based cap on the filtered snippets
      const snippetScores = news_snippets
        .map((s: any) => typeof s.score === "number" ? s.score : 0)
        .sort((a: number, b: number) => b - a);

      const bestScore = snippetScores.length > 0 ? snippetScores[0] : 0;

      if (bestScore < 6) {
        confidenceCap = 0.55;
      } else if (bestScore <= 10) {
        confidenceCap = 0.7;
      } else {
        confidenceCap = 0.9;
      }
    }

    // Validate/normalize output defensively
    const llmConfidence = clamp01(parsed.overall_confidence, 0.5);
    const cappedConfidence = Math.min(llmConfidence, confidenceCap);

    const validated: SituationReportResponse = {
      event_name_suggested: parsed.event_name_suggested || "Unnamed event",
      event_type: parsed.event_type || "otro",
      summary: parsed.summary || "",
      suggested_sectors: safeArray<any>(parsed.suggested_sectors).map((s: any) => ({
        name: s.name || "Unknown sector",
        description: s.description || "",
        latitude: typeof s.latitude === "number" ? s.latitude : null,
        longitude: typeof s.longitude === "number" ? s.longitude : null,
        confidence: clamp01(s.confidence, 0.5),
        include: s.include !== false,
      })),
      suggested_capabilities: safeArray<any>(parsed.suggested_capabilities).map((c: any) => ({
        capability_name: c.capability_name || c.name || c.capability || "Unknown",
        confidence: clamp01(c.confidence, 0.5),
        include: c.include !== false,
      })),
      sources: safeArray<any>(parsed.sources).length ? safeArray<any>(parsed.sources) : sourcesForLLM,
      overall_confidence: cappedConfidence,
    };

    // ---- Step 3: Save draft to initial_situation_reports ----
    // We'll store full news snippets as JSON for audit
    const sourcesPayload = [
      {
        kind: "news_context",
        country_code,
        collected_at: new Date().toISOString(),
        feeds_used: collected.feeds_used ?? null,
        snippets: news_snippets.slice(0, max_results),
        all_collected_count: allSnippets.length,
        location_match: locationMatch,
        mismatch_reason: summary?.mismatch_reason ?? null,
      },
    ];

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from("initial_situation_reports")
      .insert({
        created_by: user.id,
        status: "draft",
        input_text,
        event_name_suggested: validated.event_name_suggested,
        event_type: validated.event_type,
        summary: validated.summary,
        suggested_sectors: validated.suggested_sectors,
        suggested_capabilities: validated.suggested_capabilities,
        sources: sourcesPayload,
        overall_confidence: validated.overall_confidence,
      })
      .select()
      .single();

    if (insertErr) {
      return new Response(
        JSON.stringify({ error: "Failed to save initial_situation_report", detail: insertErr.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ---- Response ----
    return new Response(
      JSON.stringify({
        success: true,
        situation_report: inserted,
        context: {
          country_code,
          news_snippets: news_snippets.slice(0, max_results),
          all_collected_count: allSnippets.length,
          location_match: locationMatch,
          evidence_cap: {
            confidence_cap: confidenceCap,
            llm_confidence: llmConfidence,
            final_confidence: cappedConfidence,
          },
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

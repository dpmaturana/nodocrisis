import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EXTRACTION_PROMPT = `You are a humanitarian field report analysis assistant.
Your task is to extract structured information from an operator's written field note.

Extract the following information and return ONLY a valid JSON object:

{
  "sector_mentioned": string | null,  // Name of the sector/zone mentioned
  "capability_types": string[],        // Detected capability types. Use EXACTLY these system names: {{CAPABILITY_LIST}}
  "items": [
    {
      "name": string,                  // Item/resource name
      "quantity": number | null,       // Quantity if mentioned
      "unit": string,                  // Unit (people, liters, kg, units, etc.)
      "state": "available" | "needed" | "in_transit" | "depleted",
      "urgency": "low" | "medium" | "high" | "critical"
    }
  ],
  "location_detail": string | null,   // Specific location details
  "observations": string | null,       // Public 1-2 sentence summary (max 200 chars) in English that other actors will see
  "evidence_quotes": string[],         // Relevant verbatim quotes from the report
  "confidence": number                 // 0.0-1.0 how confident you are in the extraction
}

IMPORTANT:
- If something is not mentioned, use null or empty array
- "observations" must be a useful summary in English for other field actors
- Be conservative with urgency: only "critical" if there is immediate danger to life
- Identify capability_types even if no specific items are mentioned
- Use ONLY the exact names from the provided list for capability_types
- ALL output text must be in English, regardless of input language`;

interface ExtractedData {
  sector_mentioned: string | null;
  capability_types: string[];
  items: Array<{
    name: string;
    quantity: number | null;
    unit: string;
    state: string;
    urgency: string;
  }>;
  location_detail: string | null;
  observations: string | null;
  evidence_quotes: string[];
  confidence: number;
}


Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { event_id, sector_id, actor_id, text_note, dry_run } = await req.json();

    // In dry_run mode, we only need the text_note
    if (!dry_run && (!event_id || !sector_id || !actor_id || !text_note)) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: event_id, sector_id, actor_id, text_note" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!text_note) {
      return new Response(
        JSON.stringify({ error: "Missing required field: text_note" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client (always needed to fetch capacity types)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Processing text report (dry_run: ${!!dry_run}) for event: ${event_id}, sector: ${sector_id}`);

    let report: { id: string } | null = null;

    // 1. Create field report with status 'extracting' (skip in dry_run mode)
    if (!dry_run) {
      const { data: insertedReport, error: insertError } = await supabase
        .from("field_reports")
        .insert({
          event_id,
          sector_id,
          actor_id,
          audio_url: "text-only", // Placeholder to satisfy NOT NULL constraint
          text_note,
          status: "extracting",
        })
        .select()
        .single();

      if (insertError) {
        console.error("Insert error:", insertError);
        return new Response(
          JSON.stringify({ error: `Failed to create report: ${insertError.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      report = insertedReport;
      console.log(`Field report created: ${report!.id}, extracting from text...`);
    } else {
      console.log("Dry run mode: skipping DB insert, proceeding with LLM extraction...");
    }

    // 2. Fetch standardized capability names from DB and call LLM
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const { data: capTypes } = await supabase
      .from("capacity_types")
      .select("id, name");
    const capList = capTypes && capTypes.length > 0
      ? capTypes.map((c: { id: string; name: string }) => `"${c.name}"`).join(", ")
      : '"water","food","shelter","health","communications","rescue","logistics","energy"';

    // Inject dynamic capability list into prompt
    const finalExtractionPrompt = EXTRACTION_PROMPT.replace("{{CAPABILITY_LIST}}", capList);

    const extractResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: finalExtractionPrompt },
          { role: "user", content: `Operator field note:\n\n"${text_note}"` },
        ],
        temperature: 0.2,
        max_tokens: 1000,
      }),
    });

    if (!extractResponse.ok) {
      const errorText = await extractResponse.text();
      console.error("LLM error:", errorText);
      
      // Update report with error (only if not dry_run)
      if (!dry_run && report) {
        await supabase
          .from("field_reports")
          .update({
            status: "failed",
            error_message: `Extraction failed: ${extractResponse.status}`,
          })
          .eq("id", report.id);
      }
      
      return new Response(
        JSON.stringify({ error: "Failed to extract data from text" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const extractResult = await extractResponse.json();
    const content = extractResult.choices?.[0]?.message?.content || "";
    
    console.log("Raw LLM response:", content);

    // Parse JSON from response (handle markdown code blocks)
    let extractedData: ExtractedData;
    try {
      let jsonStr = content;
      // Remove markdown code fences if present
      if (jsonStr.includes("```")) {
        jsonStr = jsonStr.replace(/```json?\n?/g, "").replace(/```/g, "");
      }
      extractedData = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      extractedData = {
        sector_mentioned: null,
        capability_types: [],
        items: [],
        location_detail: null,
        observations: text_note.substring(0, 200),
        evidence_quotes: [text_note],
        confidence: 0.3,
      };
    }

    console.log("Extracted data:", extractedData);

    // 3. Update field report with extracted data (skip in dry_run mode)
    let updatedReport = null;
    if (!dry_run && report) {
      const { data, error: updateError } = await supabase
        .from("field_reports")
        .update({
          extracted_data: extractedData,
          status: "completed",
        })
        .eq("id", report.id)
        .select()
        .single();

      if (updateError) {
        console.error("Update error:", updateError);
      }
      updatedReport = data;

      // 4. Create signal(s) linked to specific capacity types (only if not dry_run)
      if (extractedData.observations) {
        // Build a map of capacity type name (lowercase) → id for fast lookup
        const capTypeMap = new Map(
          (capTypes ?? []).map((c: { id: string; name: string }) => [c.name.toLowerCase(), c.id])
        );

        // Map extracted capability_types to capacity_type_ids
        const linkedCapabilities = (extractedData.capability_types ?? [])
          .map((name: string) => capTypeMap.get(name.toLowerCase()))
          .filter((id): id is string => id != null);

        if (linkedCapabilities.length > 0) {
          // Create one signal per detected capacity type
          const { error: signalError } = await supabase.from("signals").insert(
            linkedCapabilities.map((capTypeId: string) => ({
              event_id,
              sector_id,
              signal_type: "field_report",
              source: "actor_text_report",
              content: extractedData.observations,
              confidence: extractedData.confidence,
              level: "sector",
              field_report_id: report.id,
              capacity_type_id: capTypeId,
            }))
          );

          if (signalError) {
            console.error("Signal creation error:", signalError);
          } else {
            console.log(`${linkedCapabilities.length} signal(s) created from text report`);
          }

          // Delegate need-level decision to the NeedLevelEngine (canonical path).
          // sector_needs_context is updated inside process-field-report-signals.
          const processSignalsUrl = Deno.env.get("PROCESS_FIELD_REPORT_SIGNALS_URL");
          if (processSignalsUrl) {
            const capacityTypeMap: Record<string, string> = {};
            for (const ct of (capTypes ?? [])) {
              capacityTypeMap[(ct as { id: string; name: string }).name] = (ct as { id: string; name: string }).id;
            }
            const engineResponse = await fetch(processSignalsUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                event_id,
                sector_id,
                extracted_data: extractedData,
                capacity_type_map: capacityTypeMap,
                report_id: report!.id,
              }),
            });
            if (!engineResponse.ok) {
              console.error("[engine path] process-field-report-signals error:", await engineResponse.text());
            } else {
              const engineResult = await engineResponse.json();
              console.log("[engine path] NeedLevelEngine results:", JSON.stringify(engineResult));
            }
          } else {
            console.warn("[engine path] PROCESS_FIELD_REPORT_SIGNALS_URL not set; skipping engine invocation");
          }
        } else {
          // Fallback: create a generic signal without capacity_type_id
          const { error: signalError } = await supabase.from("signals").insert({
            event_id,
            sector_id,
            signal_type: "field_report",
            source: "actor_text_report",
            content: extractedData.observations,
            confidence: extractedData.confidence,
            level: "sector",
            field_report_id: report.id,
          });

          if (signalError) {
            console.error("Signal creation error:", signalError);
          } else {
            console.log("Generic signal created from text report (no capability types detected)");
          }
        }
      }
    } else {
      console.log("Dry run mode: skipping DB update and signal creation");
    }

    // Build response report
    const responseReport = dry_run
      ? {
          id: `dry-run-${Date.now()}`,
          event_id: event_id || "dry-run",
          sector_id: sector_id || "dry-run",
          actor_id: actor_id || "dry-run",
          audio_url: "text-only",
          text_note,
          transcript: null,
          status: "completed",
          extracted_data: extractedData,
          error_message: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      : updatedReport || { ...report, extracted_data: extractedData, status: "completed" };

    return new Response(
      JSON.stringify({
        success: true,
        report: responseReport,
        extracted_data: extractedData,
        dry_run: !!dry_run,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in extract-text-report:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

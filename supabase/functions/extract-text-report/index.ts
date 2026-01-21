import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EXTRACTION_PROMPT = `Eres un asistente de análisis para reportes de campo de ayuda humanitaria.
Tu tarea es extraer información estructurada de la nota escrita de un operador en terreno.

Extrae la siguiente información y devuelve SOLO un objeto JSON válido:

{
  "sector_mentioned": string | null,  // Nombre del sector/zona mencionado
  "capability_types": string[],        // Tipos de capacidad: "agua", "alimento", "salud", "albergue", "transporte", "comunicaciones", "seguridad"
  "items": [
    {
      "name": string,                  // Nombre del item/recurso
      "quantity": number | null,       // Cantidad si se menciona
      "unit": string,                  // Unidad (personas, litros, kg, unidades, etc.)
      "state": "disponible" | "necesario" | "en_camino" | "agotado",
      "urgency": "baja" | "media" | "alta" | "crítica"
    }
  ],
  "location_detail": string | null,   // Detalles específicos de ubicación
  "observations": string | null,       // Resumen público de 1-2 oraciones (máx 200 caracteres) que otros actores verán
  "evidence_quotes": string[],         // Frases textuales relevantes del reporte
  "confidence": number                 // 0.0-1.0 qué tan seguro estás de la extracción
}

IMPORTANTE:
- Si no se menciona algo, usa null o array vacío
- "observations" debe ser un resumen útil para otros actores en terreno
- Sé conservador con urgency: solo "crítica" si hay peligro de vida inmediato
- Identifica capacity_types incluso si no se mencionan items específicos`;

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
    const { event_id, sector_id, actor_id, text_note } = await req.json();

    if (!event_id || !sector_id || !actor_id || !text_note) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: event_id, sector_id, actor_id, text_note" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Creating text-only field report for event: ${event_id}, sector: ${sector_id}`);

    // 1. Create field report with status 'extracting' (no audio_url needed)
    const { data: report, error: insertError } = await supabase
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

    console.log(`Field report created: ${report.id}, extracting from text...`);

    // 2. Call LLM to extract structured data from text note
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const extractResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: EXTRACTION_PROMPT },
          { role: "user", content: `Nota escrita del operador:\n\n"${text_note}"` },
        ],
        temperature: 0.2,
        max_tokens: 1000,
      }),
    });

    if (!extractResponse.ok) {
      const errorText = await extractResponse.text();
      console.error("LLM error:", errorText);
      
      // Update report with error
      await supabase
        .from("field_reports")
        .update({
          status: "failed",
          error_message: `Extraction failed: ${extractResponse.status}`,
        })
        .eq("id", report.id);
      
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

    // 3. Update field report with extracted data
    const { data: updatedReport, error: updateError } = await supabase
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

    // 4. Create a signal if there are observations
    if (extractedData.observations) {
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
        console.log("Signal created from text report");
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        report: updatedReport || { ...report, extracted_data: extractedData, status: "completed" },
        extracted_data: extractedData,
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

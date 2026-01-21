import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SuggestedSector {
  name: string;
  description: string;
  confidence: number;
  include: boolean;
}

interface SuggestedCapability {
  capability_name: string;
  confidence: number;
  include: boolean;
}

interface SituationReportResponse {
  event_name_suggested: string;
  event_type: string;
  summary: string;
  suggested_sectors: SuggestedSector[];
  suggested_capabilities: SuggestedCapability[];
  sources: string[];
  overall_confidence: number;
}

const SYSTEM_PROMPT = `Eres un asistente experto en coordinación de emergencias en Chile. Tu rol es analizar descripciones de emergencias y generar propuestas estructuradas para iniciar la respuesta coordinada.

Dado un texto que describe una emergencia, debes generar una propuesta JSON con:

1. **event_name_suggested**: Nombre descriptivo para el evento (ej: "Incendios Forestales Ñuble 2026")
2. **event_type**: Tipo de emergencia. Opciones: incendio_forestal, inundacion, terremoto, tsunami, aluvion, sequia, temporal, accidente_masivo, emergencia_sanitaria, otro
3. **summary**: Resumen de 2-3 oraciones describiendo la situación
4. **suggested_sectors**: Array de sectores geográficos afectados, cada uno con:
   - name: Nombre del sector
   - description: Breve descripción del área
   - confidence: Nivel de confianza (0.0 a 1.0)
   - include: true (por defecto)
5. **suggested_capabilities**: Array de capacidades críticas requeridas. Usa nombres estándar:
   - Agua/Bomberos
   - Transporte
   - Salud/Ambulancias
   - Maquinaria Pesada
   - Albergue
   - Alimentación
   - Búsqueda y Rescate
   - Comunicaciones
   Cada una con confidence (0.0 a 1.0) e include: true
6. **sources**: Array de fuentes mencionadas o inferidas (strings)
7. **overall_confidence**: Confianza general de la propuesta (0.0 a 1.0)

Responde ÚNICAMENTE con JSON válido, sin markdown ni explicaciones adicionales.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { input_text } = await req.json();

    if (!input_text || typeof input_text !== "string" || input_text.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Se requiere un texto describiendo la emergencia" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "Configuración de IA no disponible" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Analiza la siguiente descripción de emergencia y genera una propuesta estructurada:\n\n"${input_text}"` },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Límite de solicitudes excedido. Intenta de nuevo en unos minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA agotados. Contacta al administrador." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Error al procesar la solicitud de IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      console.error("No content in AI response:", aiResponse);
      return new Response(
        JSON.stringify({ error: "Respuesta vacía del servicio de IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse the JSON response from AI
    let situationReport: SituationReportResponse;
    try {
      // Remove any markdown code blocks if present
      const cleanedContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      situationReport = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", content, parseError);
      return new Response(
        JSON.stringify({ error: "Error al interpretar la respuesta de IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate and ensure all required fields exist
    const validatedReport: SituationReportResponse = {
      event_name_suggested: situationReport.event_name_suggested || "Evento sin nombre",
      event_type: situationReport.event_type || "otro",
      summary: situationReport.summary || "",
      suggested_sectors: Array.isArray(situationReport.suggested_sectors) 
        ? situationReport.suggested_sectors.map(s => ({
            name: s.name || "Sector desconocido",
            description: s.description || "",
            confidence: typeof s.confidence === "number" ? Math.min(1, Math.max(0, s.confidence)) : 0.5,
            include: s.include !== false,
          }))
        : [],
      suggested_capabilities: Array.isArray(situationReport.suggested_capabilities)
        ? situationReport.suggested_capabilities.map(c => ({
            capability_name: c.capability_name || "Capacidad desconocida",
            confidence: typeof c.confidence === "number" ? Math.min(1, Math.max(0, c.confidence)) : 0.5,
            include: c.include !== false,
          }))
        : [],
      sources: Array.isArray(situationReport.sources) ? situationReport.sources : [],
      overall_confidence: typeof situationReport.overall_confidence === "number" 
        ? Math.min(1, Math.max(0, situationReport.overall_confidence)) 
        : 0.5,
    };

    return new Response(
      JSON.stringify(validatedReport),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-situation-report:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

interface AIReport {
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

async function generateReport(inputText: string, apiKey: string): Promise<AIReport> {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Analiza la siguiente descripción de emergencia y genera una propuesta estructurada:\n\n"${inputText}"`,
        },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    if (response.status === 429) throw new Error("RATE_LIMIT");
    if (response.status === 402) throw new Error("CREDITS_EXHAUSTED");
    throw new Error(`AI_ERROR_${response.status}`);
  }

  const aiResponse = await response.json();
  const content = aiResponse.choices?.[0]?.message?.content;
  if (!content) throw new Error("EMPTY_AI_RESPONSE");

  const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const parsed: AIReport = JSON.parse(cleaned);

  // Validate / sanitize
  return {
    event_name_suggested: parsed.event_name_suggested || "Evento sin nombre",
    event_type: parsed.event_type || "otro",
    summary: parsed.summary || "",
    suggested_sectors: Array.isArray(parsed.suggested_sectors)
      ? parsed.suggested_sectors.map((s) => ({
          name: s.name || "Sector desconocido",
          description: s.description || "",
          confidence: typeof s.confidence === "number" ? Math.min(1, Math.max(0, s.confidence)) : 0.5,
          include: s.include !== false,
        }))
      : [],
    suggested_capabilities: Array.isArray(parsed.suggested_capabilities)
      ? parsed.suggested_capabilities.map((c) => ({
          capability_name: c.capability_name || "Capacidad desconocida",
          confidence: typeof c.confidence === "number" ? Math.min(1, Math.max(0, c.confidence)) : 0.5,
          include: c.include !== false,
        }))
      : [],
    sources: Array.isArray(parsed.sources) ? parsed.sources : [],
    overall_confidence:
      typeof parsed.overall_confidence === "number"
        ? Math.min(1, Math.max(0, parsed.overall_confidence))
        : 0.5,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Extract auth token from request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify the user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { input_text } = await req.json();
    if (!input_text || typeof input_text !== "string" || input_text.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Se requiere un texto describiendo la emergencia" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Configuración de IA no disponible" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Generate AI report
    let report: AIReport;
    try {
      report = await generateReport(input_text, LOVABLE_API_KEY);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "AI_ERROR";
      const statusMap: Record<string, { code: number; text: string }> = {
        RATE_LIMIT: { code: 429, text: "Límite de solicitudes excedido. Intenta de nuevo en unos minutos." },
        CREDITS_EXHAUSTED: { code: 402, text: "Créditos de IA agotados. Contacta al administrador." },
        EMPTY_AI_RESPONSE: { code: 500, text: "Respuesta vacía del servicio de IA" },
      };
      const mapped = statusMap[msg] ?? { code: 500, text: "Error al procesar la solicitud de IA" };
      return new Response(
        JSON.stringify({ error: mapped.text }),
        { status: mapped.code, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Persist to initial_situation_reports using service role for insert
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("initial_situation_reports")
      .insert({
        input_text: input_text.trim(),
        created_by: user.id,
        status: "draft",
        event_name_suggested: report.event_name_suggested,
        event_type: report.event_type,
        summary: report.summary,
        suggested_sectors: report.suggested_sectors,
        suggested_capabilities: report.suggested_capabilities,
        sources: report.sources,
        overall_confidence: report.overall_confidence,
      })
      .select()
      .single();

    if (insertError) {
      console.error("DB insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Error al guardar el reporte" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(inserted), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in create-initial-situation-report:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

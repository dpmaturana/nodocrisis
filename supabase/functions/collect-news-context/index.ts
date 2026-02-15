import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Eres un analista de inteligencia de emergencias. Tu tarea es buscar en tu conocimiento sobre publicaciones recientes en X (Twitter) y otras fuentes de noticias relacionadas con la consulta de emergencia proporcionada.

Debes responder ÚNICAMENTE con JSON válido con esta estructura:
{
  "tweets": [
    {
      "author": "nombre o @handle del autor",
      "text": "contenido del tweet o noticia",
      "date": "fecha aproximada ISO 8601",
      "metrics": { "likes": 0, "retweets": 0, "replies": 0 },
      "relevance": 0.95,
      "source": "X" | "news" | "official"
    }
  ],
  "summary": "Resumen ejecutivo de 2-3 oraciones sobre la situación según las fuentes encontradas",
  "query_used": "la consulta original",
  "sources_count": 5,
  "confidence": 0.8
}

Genera entre 5 y 15 resultados relevantes. Prioriza fuentes oficiales (ONEMI, SENAPRED, Bomberos, etc.) y medios verificados. Incluye métricas estimadas cuando sea posible. Si no encuentras información específica, indica confianza baja y menciona que los datos son limitados.

Responde ÚNICAMENTE con JSON válido, sin markdown ni explicaciones adicionales.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, max_results } = await req.json();

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Se requiere un campo 'query' con la búsqueda" }),
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

    const limit = Math.min(Math.max(max_results || 10, 1), 20);

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
          { role: "user", content: `Busca información reciente sobre: "${query}". Genera hasta ${limit} resultados relevantes de X (Twitter) y fuentes de noticias.` },
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
          JSON.stringify({ error: "Créditos de IA agotados." }),
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

    let parsed;
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content, parseError);
      return new Response(
        JSON.stringify({ error: "Error al interpretar la respuesta de IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validated = {
      tweets: Array.isArray(parsed.tweets) ? parsed.tweets.map((t: any) => ({
        author: t.author || "Desconocido",
        text: t.text || "",
        date: t.date || null,
        metrics: t.metrics || { likes: 0, retweets: 0, replies: 0 },
        relevance: typeof t.relevance === "number" ? Math.min(1, Math.max(0, t.relevance)) : 0.5,
        source: t.source || "unknown",
      })) : [],
      summary: parsed.summary || "",
      query_used: query,
      sources_count: parsed.sources_count || 0,
      confidence: typeof parsed.confidence === "number" ? Math.min(1, Math.max(0, parsed.confidence)) : 0.5,
    };

    return new Response(
      JSON.stringify(validated),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in collect-news-context:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

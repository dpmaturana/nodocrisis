// supabase/functions/collect-news-context/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type NewsItem = {
  source_name: string;
  title: string;
  url: string | null;
  published_at: string | null;
  snippet: string;
  score: number;
};

function normalizeText(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function keywordsFromQuery(q: string): string[] {
  const stop = new Set([
    "the","a","an","and","or","of","to","in","on","at",
    "for","from","is","are","there","right","now","near",
  ]);
  const tokens = normalizeText(q)
    .split(" ")
    .filter((t) => t.length >= 3 && !stop.has(t));
  return Array.from(new Set(tokens)).slice(0, 14);
}

function scoreItem(title: string, snippet: string, keywords: string[]) {
  const t = normalizeText(title);
  const s = normalizeText(snippet);
  let score = 0;
  for (const k of keywords) {
    if (t.includes(k)) score += 4;
    if (s.includes(k)) score += 1;
  }
  return score;
}

function extractSnippet(r: any): string {
  if (r.snippet && r.snippet.trim()) return r.snippet;
  if (Array.isArray(r.stories) && r.stories.length > 0) {
    for (const s of r.stories) {
      if (s.snippet && s.snippet.trim()) return s.snippet;
    }
  }
  return r.highlight ?? r.description ?? "";
}

function flattenResults(rawResults: any[]): any[] {
  const flat: any[] = [];
  for (const r of rawResults) {
    if (Array.isArray(r.stories) && r.stories.length > 0) {
      for (const s of r.stories) {
        flat.push({
          title: s.title ?? r.title ?? "",
          snippet: s.snippet ?? r.snippet ?? "",
          link: s.link ?? r.link ?? null,
          date: s.date ?? r.date ?? null,
          source: s.source ?? r.source,
        });
      }
    } else {
      flat.push(r);
    }
  }
  return flat;
}

// ---- NEW: fetch from SerpAPI Google News ----
async function fetchFromSerpApi(
  query: string,
  country_code: string,
  max_results: number,
  lang?: string,
): Promise<NewsItem[]> {
  const apiKey = Deno.env.get("SERPAPI_KEY");
  if (!apiKey) throw new Error("SERPAPI_KEY env var is not set");

  const keywords = keywordsFromQuery(query);

  // Map country_code to SerpAPI gl param (ISO 3166-1 alpha-2 lowercase)
  const gl = country_code.toLowerCase(); // e.g. "es", "cl", "us"
  const hl = (lang ?? gl).toLowerCase();

  const params = new URLSearchParams({
    engine: "google_news",
    q: query,
    gl,
    hl,
    tbs: "qdr:w",
    num: String(Math.min(max_results * 2, 20)),
    api_key: apiKey,
  });

  const res = await fetch(`https://serpapi.com/search?${params.toString()}`);
  if (!res.ok) throw new Error(`SerpAPI request failed: ${res.status}`);

  const json = await res.json();
  const rawResults: any[] = json?.news_results ?? [];

  const flatResults = flattenResults(rawResults);

  const items: NewsItem[] = flatResults.map((r: any) => {
    const title = r.title ?? "";
    const snippet = extractSnippet(r);
    return {
      source_name: r.source?.name ?? "Google News",
      title,
      url: r.link ?? null,
      published_at: r.date ?? null,
      snippet: snippet.slice(0, 320),
      score: scoreItem(title, snippet, keywords),
    };
  });

  // Sort by relevance score
  items.sort((a, b) => b.score - a.score);
  return items.slice(0, max_results);
}

async function storeIngestedItems(country_code: string, items: NewsItem[]): Promise<void> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn("[storeIngestedItems] Supabase env vars not set — skipping persistence");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { error } = await supabase.from("ingested_news_items").insert(
    items.map((it) => ({
      country_code,
      source_name: it.source_name,
      title: it.title,
      url: it.url,
      published_at: it.published_at,
      snippet: it.snippet,
      raw: it,
    })),
  );

  if (error) {
    console.error("[storeIngestedItems] Insert failed:", error.message, error.code);
  }
}

async function summarizeWithLovable(query: string, items: NewsItem[]) {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return null;

  const top = items.slice(0, 8).map((it, idx) => ({
    id: `news_${idx + 1}`,
    source: it.source_name,
    title: it.title,
    snippet: it.snippet,
    url: it.url,
    published_at: it.published_at,
  }));

  const system = `You summarize news context for crisis coordination.

CRITICAL ANCHOR RULE:
- The admin input defines the target incident and location.
- ONLY summarize snippets that clearly refer to the SAME incident/location as the admin input.
- If the snippets appear to be about a different place or different incident, DO NOT switch topics.
- In that case, return a summary that says the news evidence does not confirm the admin incident.

Return ONLY valid JSON.

Output schema:
{
  "summary": string,
  "key_points": string[],
  "confidence": number,
  "used": [{ "id": string, "why": string }],
  "location_match": boolean,
  "mismatch_reason": string | null
}

Rules:
- Be conservative: if uncertain, say so and lower confidence.
- Do NOT invent facts not supported by the snippets.
- confidence must be LOW (<0.5) if location_match is false.`;

  const user = `Query: "${query}"\n\nNews snippets:\n${JSON.stringify(top, null, 2)}`;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.2,
      max_tokens: 700,
    }),
  });

  if (!resp.ok) return null;

  const json = await resp.json();
  const content = json?.choices?.[0]?.message?.content ?? "";
  try {
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();

    const query =
      typeof body.query === "string" ? body.query
      : typeof body.query_text === "string" ? body.query_text
      : typeof body.input_text === "string" ? body.input_text
      : "";

    const maxRaw =
      typeof body.max_results === "number" ? body.max_results
      : typeof body.max_items === "number" ? body.max_items
      : typeof body.maxResults === "number" ? body.maxResults
      : undefined;

    const max_results = typeof maxRaw === "number" ? Math.max(1, Math.min(20, maxRaw)) : 8;

    const country_code =
      typeof body.country_code === "string" ? body.country_code.toUpperCase()
      : typeof body.country === "string" ? body.country.toUpperCase()
      : null;

    const summarize = body.summarize === true;

    if (!query.trim()) {
      return new Response(JSON.stringify({ error: "Missing query (or query_text)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!country_code) {
      return new Response(JSON.stringify({ error: "Missing country_code (e.g. 'CL', 'US', 'PE')" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lang = typeof body.lang === "string" ? body.lang : undefined;

    // ---- Single SerpAPI call replaces multi-feed RSS fetching ----
    const top = await fetchFromSerpApi(query, country_code, max_results, lang);

    await storeIngestedItems(country_code, top);

    const summary = summarize ? await summarizeWithLovable(query, top) : null;

    return new Response(
      JSON.stringify({
        country_code,
        query,
        keywords: keywordsFromQuery(query),
        source: "serpapi_google_news",
        news_snippets: top,
        summary,
        note: {
          accepted_params: ["query|max_results", "query_text|max_items", "country_code", "summarize"],
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

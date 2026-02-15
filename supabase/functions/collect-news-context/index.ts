// supabase/functions/collect-news-context/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { XMLParser } from "https://esm.sh/fast-xml-parser@4.4.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Fallback feeds (used if DB table country_news_sources is not present / empty)
const DEFAULT_ES_FEEDS = [
  { source_name: "El País", rss_url: "https://elpais.com/rss/elpais/portada.xml" },
  { source_name: "RTVE", rss_url: "https://www.rtve.es/rss/temas_noticias.xml" },
  { source_name: "Europa Press", rss_url: "https://www.europapress.es/rss/rss.aspx" },
  { source_name: "BBC", rss_url: "https://feeds.bbci.co.uk/news/rss.xml?edition=int" },
  { source_name: "The Guardian", rss_url: "https://www.theguardian.com/world/rss" },
];

type Feed = { source_name: string; rss_url: string };

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
  // Minimal stopwords; you can expand later
  const stop = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "of",
    "to",
    "in",
    "on",
    "at",
    "for",
    "from",
    "is",
    "are",
    "there",
    "right",
    "now",
    "near",
  ]);
  const tokens = normalizeText(q)
    .split(" ")
    .filter((t) => t.length >= 3 && !stop.has(t));
  return Array.from(new Set(tokens)).slice(0, 14);
}

function scoreItem(title: string, desc: string, keywords: string[]) {
  const t = normalizeText(title);
  const d = normalizeText(desc);
  let score = 0;
  for (const k of keywords) {
    if (t.includes(k)) score += 4; // title is strong
    if (d.includes(k)) score += 1;
  }
  return score;
}

function stripHtml(input: string) {
  return (input || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchRssItems(feedUrl: string) {
  const res = await fetch(feedUrl, {
    headers: {
      "User-Agent": "NodoCrisis/1.0 (collect-news-context)",
      Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
    },
  });
  if (!res.ok) throw new Error(`RSS fetch failed (${res.status}) for ${feedUrl}`);
  const xml = await res.text();

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    trimValues: true,
  });

  const parsed = parser.parse(xml);

  // RSS 2.0: parsed.rss.channel.item
  const channel = parsed?.rss?.channel;
  const itemsRaw = channel?.item;

  const items = Array.isArray(itemsRaw) ? itemsRaw : itemsRaw ? [itemsRaw] : [];

  return items.map((it: any) => ({
    title: it.title ?? "",
    link: typeof it.link === "string" ? it.link : (it.link?.["#text"] ?? ""),
    pubDate: it.pubDate ?? it.updated ?? it["dc:date"] ?? null,
    description: it.description ?? it["content:encoded"] ?? it.summary ?? "",
  }));
}

async function loadFeedsFromDb(country_code: string, limit = 5): Promise<Feed[] | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  // If not configured, we can't read DB here—fallback.
  if (!supabaseUrl || !supabaseServiceKey) return null;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Table might not exist yet; catch and fallback.
  const { data, error } = await supabase
    .from("country_news_sources")
    .select("source_name,rss_url,enabled,country_code")
    .eq("country_code", country_code)
    .eq("enabled", true)
    .limit(limit);

  if (error) return null;
  if (!data || data.length === 0) return [];

  return data.map((r: any) => ({ source_name: r.source_name, rss_url: r.rss_url }));
}

async function storeIngestedItems(country_code: string, items: NewsItem[]) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseServiceKey) return;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Table might not exist; ignore if it fails.
  try {
    await supabase.from("ingested_news_items").insert(
      items.map((it) => ({
        country_code,
        source_name: it.source_name,
        title: it.title,
        url: it.url,
        published_at: it.published_at,
        snippet: it.snippet,
        raw: it, // keep what we used
      })),
    );
  } catch {
    // no-op
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
Return ONLY valid JSON.

Output schema:
{
  "summary": string,              // 1-3 sentences
  "key_points": string[],         // 3-7 bullets max
  "confidence": number,           // 0-1
  "used": { "id": string, "why": string }[] // references to the provided ids
}

Rules:
- Be conservative: if uncertain, say so and lower confidence.
- Do NOT invent facts not supported by the snippets.`;

  const user = `Query: "${query}"

News snippets:
${JSON.stringify(top, null, 2)}`;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
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
    const cleaned = content
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();

    // Accept both naming styles:
    // - query / max_results
    // - query_text / max_items
    const query =
      typeof body.query === "string"
        ? body.query
        : typeof body.query_text === "string"
          ? body.query_text
          : typeof body.input_text === "string"
            ? body.input_text // extra friendly
            : "";

    const maxRaw =
      typeof body.max_results === "number"
        ? body.max_results
        : typeof body.max_items === "number"
          ? body.max_items
          : typeof body.maxResults === "number"
            ? body.maxResults
            : undefined;

    const max_results = typeof maxRaw === "number" ? Math.max(1, Math.min(20, maxRaw)) : 8;

    const country_code =
      typeof body.country_code === "string"
        ? body.country_code.toUpperCase()
        : typeof body.country === "string"
          ? body.country.toUpperCase()
          : "ES";

    const summarize = body.summarize === true; // optional

    if (!query.trim()) {
      return new Response(JSON.stringify({ error: "Missing query (or query_text)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load feeds from DB if possible; fallback to defaults
    let feeds = await loadFeedsFromDb(country_code, 5);
    if (!feeds || feeds.length === 0) {
      feeds = country_code === "ES" ? DEFAULT_ES_FEEDS : DEFAULT_ES_FEEDS;
    }

    const keywords = keywordsFromQuery(query);

    const results = await Promise.allSettled(
      feeds.map(async (f) => {
        const items = await fetchRssItems(f.rss_url);
        return { feed: f, items };
      }),
    );

    const scored: NewsItem[] = [];

    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      const { feed, items } = r.value;

      for (const it of items.slice(0, 30)) {
        const title = (it.title || "").toString();
        const desc = stripHtml((it.description || "").toString());
        const score = scoreItem(title, desc, keywords);

        if (score > 0) {
          scored.push({
            source_name: feed.source_name,
            title,
            url: it.link ? it.link.toString() : null,
            published_at: it.pubDate ? it.pubDate.toString() : null,
            snippet: desc.slice(0, 320),
            score,
          });
        }
      }
    }

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, max_results);

    // Optional: store ingested items (if table exists)
    await storeIngestedItems(country_code, top);

    // Optional: summarize via Lovable (if summarize:true and key exists)
    const summary = summarize ? await summarizeWithLovable(query, top) : null;

    return new Response(
      JSON.stringify({
        country_code,
        query,
        keywords,
        feeds_used: feeds.map((f) => ({ source_name: f.source_name, rss_url: f.rss_url })),
        news_snippets: top,
        summary, // null unless summarize=true and LOVABLE_API_KEY set
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

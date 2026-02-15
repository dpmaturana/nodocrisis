import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { XMLParser } from "https://esm.sh/fast-xml-parser@4.4.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Hardcoded starter feeds (Spain + global)
const ES_DEFAULT_FEEDS = [
  { name: "El País", rss_url: "https://elpais.com/rss/elpais/portada.xml" },
  { name: "RTVE", rss_url: "https://www.rtve.es/rss/temas_noticias.xml" },
  { name: "Europa Press", rss_url: "https://www.europapress.es/rss/rss.aspx" },
  { name: "BBC", rss_url: "https://feeds.bbci.co.uk/news/rss.xml?edition=int" },
  { name: "The Guardian", rss_url: "https://www.theguardian.com/world/rss" },
];

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
  ]);
  const tokens = normalizeText(q)
    .split(" ")
    .filter((t) => t.length >= 3 && !stop.has(t));
  // Keep unique
  return Array.from(new Set(tokens)).slice(0, 12);
}

function scoreItem(title: string, desc: string, keywords: string[]) {
  const t = normalizeText(title);
  const d = normalizeText(desc);
  let score = 0;
  for (const k of keywords) {
    if (t.includes(k)) score += 4; // title matches matter more
    if (d.includes(k)) score += 1;
  }
  return score;
}

async function fetchRssItems(feedUrl: string) {
  const res = await fetch(feedUrl, { headers: { "User-Agent": "NodoCrisis/1.0" } });
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
    link: it.link ?? "",
    pubDate: it.pubDate ?? it.updated ?? null,
    description: it.description ?? it["content:encoded"] ?? "",
  }));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { country_code, query_text, max_items } = await req.json();

    if (!query_text || typeof query_text !== "string") {
      return new Response(JSON.stringify({ error: "query_text is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const feeds = country_code === "ES" || !country_code ? ES_DEFAULT_FEEDS : ES_DEFAULT_FEEDS;
    const keywords = keywordsFromQuery(query_text);

    // Fetch all feeds in parallel
    const results = await Promise.allSettled(
      feeds.map(async (f) => {
        const items = await fetchRssItems(f.rss_url);
        return { feed: f, items };
      }),
    );

    const scored: Array<any> = [];

    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      const { feed, items } = r.value;

      for (const it of items.slice(0, 30)) {
        // only check latest 30 per feed
        const score = scoreItem(it.title, it.description, keywords);
        if (score > 0) {
          scored.push({
            source_name: feed.name,
            title: it.title,
            url: it.link,
            published_at: it.pubDate,
            snippet: normalizeText(it.description).slice(0, 280),
            score,
          });
        }
      }
    }

    scored.sort((a, b) => b.score - a.score);

    const limit = typeof max_items === "number" ? Math.max(1, Math.min(20, max_items)) : 8;

    return new Response(
      JSON.stringify({
        country_code: country_code ?? "ES",
        query_text,
        keywords,
        news_snippets: scored.slice(0, limit),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

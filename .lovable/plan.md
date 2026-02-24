

## Findings from the France Event Test

### What the news actually contains

I fetched all 5 unique news URLs from the last France event. Here's what each one has:

**Euronews** (most useful): "Loire spill across streets and car parks in **Les Ponts-de-Cé, near Angers**. Water now reaches building fronts... 35 straight days of rain... Several western **departments** remain on red alert as Storm Pedro approaches."

**Evrimagaci** (gold mine — richest article): "Four departments in western France — **Charente-Maritime, Gironde, Lot-et-Garonne, and Maine-et-Loire** — remained on red alert... **Angers**, a mid-western city, saw roads along the Maine river deliberately flooded... In **La Réole, Gironde**, the drinking water network was disrupted... 1,700 people had been evacuated in **Lot-et-Garonne**... winds of 100 km/h battered the southwest... gales reaching 140 km/h around **Perpignan and the eastern Pyrénées**."

**WION**: Only a paragraph — "Several departments along France's west coast remain on maximum flood alert." No specific place names.

**Yahoo/Africanews**: Mirrors of Euronews — same content, "Les Ponts-de-Cé, near Angers."

### The core problem confirmed

The system currently sends this to the LLM as the snippet for **every** article:

> "France on edge as Loire floods and storm Pedro threatens more chaos"

That's the **title repeated as the snippet** because Google News API returned no body text. The LLM never saw "Charente-Maritime", "Gironde", "Lot-et-Garonne", "Maine-et-Loire", "Angers", "La Réole", or "Perpignan" — so it invented generic compass sectors.

### What article fetching would have given us

If we had fetched the Evrimagaci article alone, the LLM would have received mentions of **7 specific French departments and cities**. That's enough for 5-6 granular operational sectors.

---

## Updated Plan

Two changes to `collect-news-context/index.ts`, one to `create-initial-situation-report/index.ts`.

### Change 1: Article text enrichment in `collect-news-context`

**File: `supabase/functions/collect-news-context/index.ts`**

After SerpAPI returns results and before scoring, attempt to fetch article content from each URL and **append** it to the existing snippet (not replace). The snippet field becomes: `title + " | " + extracted_article_text`.

- For the top 5 results that have a URL, fetch the page with a 3-second timeout
- Extract text from `<p>` tags using regex, strip HTML tags, take first 500 characters
- **Append** the extracted text to the existing snippet: `snippet = original_snippet + " | " + article_text`
- If fetch fails (timeout, CORS, paywall), keep the original snippet unchanged
- Run all fetches in parallel with `Promise.allSettled()`
- Re-score items after enrichment (the appended text gives keywords more surface area to match)

```text
Current snippet:
  "France on edge as Loire floods and storm Pedro threatens more chaos"

Enriched snippet (additive):
  "France on edge as Loire floods and storm Pedro threatens more chaos | 
   Four departments in western France—Charente-Maritime, Gironde, 
   Lot-et-Garonne, and Maine-et-Loire—remained on red alert for flooding. 
   Angers saw roads along the Maine river deliberately flooded. In La Réole, 
   Gironde, the drinking water network was disrupted..."
```

### Change 2: Geographic decomposition in LLM prompt

**File: `supabase/functions/create-initial-situation-report/index.ts`**

Add after line 62 (after "If no specific places are available..."):

> "GEOGRAPHIC DECOMPOSITION RULE: If you identify a broad geographic feature (river basin, coastal region, mountain range, compass-direction zone like 'Western France'), you MUST decompose it into 3-5 specific municipalities, departments, or named areas along that feature. For example: instead of 'Loire River Basin', suggest 'Nantes – Loire-Atlantique', 'Angers – Maine-et-Loire', 'Tours – Indre-et-Loire'. Use your geographic knowledge to produce plausible granular locations even when news snippets only mention the broad feature."

### Change 3: Pass full snippet content to the main LLM

**File: `supabase/functions/create-initial-situation-report/index.ts`**

Currently (line 364-368), `sourcesForLLM` only passes titles:
```ts
const sourcesForLLM = news_snippets.slice(0, 10).map((s) => {
  const src = s.source_name ?? "Unknown";
  const title = s.title ?? "";
  return `${src}: ${title}`.slice(0, 180);
});
```

This truncates at 180 chars, cutting off the enriched article text. Update to also include the snippet content in the user prompt — the snippets are already passed as JSON at line 392, but `sourcesForLLM` (the fallback for the `sources` field in output) should also reflect the richer content. No change needed here actually — the JSON dump at line 392 already includes the full snippet field. The enrichment in Change 1 is sufficient.

### Technical details

**Article extraction function** (new, in `collect-news-context/index.ts`):
```text
async function fetchArticleText(url: string, timeoutMs = 3000): Promise<string | null>
  - fetch with AbortSignal.timeout
  - read response as text
  - extract <p> tag contents via regex
  - strip inner HTML tags
  - concatenate paragraphs, return first 500 chars
  - return null on any error
```

**Enrichment integration point**: After `flattenResults()` produces items, before `scoreItem()` is called. Fetch article text for top 5 URLs, append to their snippets, then score.

**Latency impact**: ~2-3 seconds added (parallel fetches with 3s timeout). Acceptable — the pipeline already takes 8-15 seconds.

**No database changes needed.** The `snippet` field in `ingested_news_items` is text and will accommodate the longer enriched content.


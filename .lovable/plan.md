

# Fix SerpAPI Google News Integration

## Problems Found

1. **`tbs: "qdr:w"` parameter is unsupported** -- The Google News engine on SerpAPI does not support the `tbs` (time-based search) parameter. This likely causes unexpected filtering or is silently ignored. The user's direct API call (which returned 13 rich results) did not include this parameter.

2. **No `snippet` field exists in Google News results** -- Google News results contain `title`, `source`, `link`, `date`, and `thumbnail` -- but never `snippet`, `highlight`, or `description`. The current `extractSnippet` function finds nothing and returns an empty string for every item. This means:
   - Keyword scoring against snippet text always scores 0 (only title matching works)
   - The LLM summarizer receives empty snippet text, degrading summary quality

3. **`num` parameter may be unsupported** -- Google News engine may not respect the `num` parameter. Removing it could yield more results naturally.

## Changes

### File: `supabase/functions/collect-news-context/index.ts`

**A. Remove unsupported parameters (`tbs`, `num`)**

Remove `tbs: "qdr:w"` and `num` from the SerpAPI request parameters. Google News results are already sorted by recency by default.

```typescript
// Before
const params = new URLSearchParams({
  engine: "google_news",
  q: query,
  gl,
  hl,
  tbs: "qdr:w",
  num: String(Math.min(max_results * 2, 20)),
  api_key: apiKey,
});

// After
const params = new URLSearchParams({
  engine: "google_news",
  q: query,
  gl,
  hl,
  api_key: apiKey,
});
```

**B. Use `title` as the snippet content**

Since Google News results have no snippet/description field, use the `title` as the primary text content. This is what the LLM summarizer and keyword scorer will work with. The title is the only meaningful text Google News provides.

Update the mapping to set `snippet` equal to `title` when no actual snippet exists:

```typescript
const snippet = extractSnippet(r) || title;
```

This way keyword scoring works against the title in both the title and snippet slots (boosting relevant matches), and the LLM gets actual text to summarize.

**C. Update `flattenResults` to preserve all fields**

Ensure `thumbnail`, `iso_date`, and `source` object are carried through the flattening process, so the LLM and downstream consumers have richer data to work with.

### Summary of impact

- More results returned (no artificial `tbs`/`num` filtering)
- Keyword scoring actually works (titles used as snippet fallback)
- LLM summarizer receives meaningful text content
- Results match what the direct API call returns



# Add Search Query Optimization Step

## Problem
The admin's raw input text (e.g., "flooding in greece islands") is passed directly as the search query to `collect-news-context`. Natural language descriptions often produce narrower, less relevant Google News results compared to concise keyword queries (e.g., "greece flooding").

## Solution
Add a lightweight LLM call between the location detection step and the news collection step. This call extracts 2-3 concise search keywords from the admin's input, which are then used as the `query` parameter for `collect-news-context`.

## Changes

### File: `supabase/functions/create-initial-situation-report/index.ts`

**A. Add a new helper function `generateSearchQuery`**

This function calls the Lovable AI Gateway with a focused prompt to extract concise search keywords from the admin's natural language input. It returns a short keyword string optimized for Google News search.

```typescript
async function generateSearchQuery(
  inputText: string,
  countryCode: string,
  lovableKey: string,
): Promise<string | null> {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        {
          role: "system",
          content: `Extract 2-3 concise Google News search keywords from the incident description.
Return ONLY the keywords as a short search query string. No quotes, no explanation.
Focus on: incident type + location name(s).
Examples:
- "there is massive flooding in the greek islands" -> "greece islands flooding"
- "terremoto de magnitud 7 en Valparaíso Chile" -> "earthquake Valparaiso Chile"
- "wildfire spreading across northern California near Sacramento" -> "California wildfire Sacramento"`,
        },
        { role: "user", content: inputText },
      ],
      temperature: 0,
      max_tokens: 30,
    }),
  });

  if (!resp.ok) return null;
  const json = await resp.json();
  const content = json?.choices?.[0]?.message?.content?.trim() ?? "";
  return content.length > 0 && content.length < 100 ? content : null;
}
```

Key design choices:
- Uses `gemini-2.5-flash-lite` (cheapest/fastest model) since this is a trivial extraction task
- Strict max_tokens (30) to prevent verbose output
- Falls back to original `input_text` if the call fails

**B. Call `generateSearchQuery` before `collect-news-context`**

Insert the call between the country detection block (line ~253) and the news collection step (line ~255). The LOVABLE_API_KEY is already available at this point (either from the detection step or fetched later).

```typescript
// ---- Step 0.5: Optimize search query ----
const lovableKeyForSearch = Deno.env.get("LOVABLE_API_KEY");
let searchQuery = input_text; // fallback to raw input
if (lovableKeyForSearch) {
  const optimized = await generateSearchQuery(input_text, country_code, lovableKeyForSearch);
  if (optimized) {
    searchQuery = optimized;
  }
}

// ---- Step 1: Collect news context ----
// ... change `query: input_text` to `query: searchQuery`
```

**C. Pass `searchQuery` instead of `input_text` to collect-news-context**

In the fetch call body (line ~266-272), replace `query: input_text` with `query: searchQuery`.

The original `input_text` continues to be used everywhere else (LLM situation report prompt, database storage) -- only the news search query changes.

## Impact
- One additional lightweight LLM call (~30 tokens, flash-lite model, minimal cost/latency)
- Broader, more recent Google News results
- No changes to the rest of the pipeline -- the raw `input_text` is still stored and used for the main situation report generation

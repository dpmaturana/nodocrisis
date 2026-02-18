

# Fix: Pre-filter Snippets in collect-news-context (Not in the Main Prompt)

## The Problem

Right now, `collect-news-context` returns ALL snippets with score > 0, even if they're about a completely different location/incident. Then `create-initial-situation-report` passes them all to the LLM and hopes the SYSTEM_PROMPT filters them out. That's backwards -- the context function should do the filtering so only relevant snippets reach the main LLM.

## The Fix

### 1. Enable `summarize: true` in `create-initial-situation-report`

Change line 183 from `summarize: false` to `summarize: true`. This activates the anchor-rule LLM pass in `collect-news-context` that already exists and already returns `location_match` and `mismatch_reason`.

### 2. Filter snippets based on the summary result (in `create-initial-situation-report`)

After getting the response from `collect-news-context`, check the `summary` object:

- If `summary.location_match === false`: drop ALL snippets (or keep zero). Pass an empty snippets array to the main LLM.
- If `summary.location_match === true`: keep only the snippets referenced in `summary.used[]` (the ones the pre-screening LLM confirmed are relevant).
- If `summary` is null (LLM key missing or failure): fall back to current behavior (pass all snippets).

### 3. Pass the quality signal to the main LLM prompt

Update the `userPrompt` template in `create-initial-situation-report` to include:

```text
NEWS EVIDENCE STATUS:
- Relevant snippets found: X (out of Y collected)
- Location match: true/false
```

When no relevant snippets survive filtering, the section becomes:

```text
NEWS EVIDENCE STATUS:
- No relevant news snippets were found for this incident.
- Generate sectors and capabilities based on the admin description alone.
```

### 4. Adjust confidence cap based on filtering outcome

In `create-initial-situation-report`, add a new condition before the existing caps:

- If `location_match === false` or zero snippets survived filtering: cap confidence at **0.40**
- This replaces the current logic that only checks raw snippet scores

### 5. Simplify the main SYSTEM_PROMPT

Remove any "validate snippet relevance" instructions from the SYSTEM_PROMPT in `create-initial-situation-report`. It no longer needs to do that job -- the snippets it receives are already pre-validated. Keep the prompt focused on generating sectors + capabilities.

## Files Changed

| File | What changes |
|---|---|
| `supabase/functions/create-initial-situation-report/index.ts` | Enable `summarize: true`; filter snippets using `summary.used[]` and `summary.location_match`; update userPrompt to show evidence status; add 0.40 confidence cap for no-match; simplify SYSTEM_PROMPT |
| `supabase/functions/collect-news-context/index.ts` | No changes needed -- anchor rule and `location_match` already implemented |

## Expected Result

- "incendio de manlleu" + Sierra Bermeja snippets: pre-screening says `location_match: false`, snippets get dropped, main LLM receives zero snippets, generates based on admin text alone with confidence capped at 0.40.
- Real matching news: pre-screening says `location_match: true`, only confirmed snippets pass through, main LLM gets clean context, confidence reflects actual evidence.


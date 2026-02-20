
# Fix fetch-tweets to use GROK_API_KEY secret

## Problem

The `fetch-tweets` edge function reads `Deno.env.get("XAI_API_KEY")` but the configured secret is named `GROK_API_KEY`. This causes the "XAI_API_KEY secret is not configured" error.

## Change

Update `supabase/functions/fetch-tweets/index.ts` to read `GROK_API_KEY` instead of `XAI_API_KEY`:

- Line 326: `Deno.env.get("XAI_API_KEY")` becomes `Deno.env.get("GROK_API_KEY")`
- Line 329: Error message updated to reference `GROK_API_KEY`

## After Deploy

Call the function again with the flooding-in-western-france event to verify signals are created:

```
POST /fetch-tweets
{
  "event_id": "22dba5aa-47e9-4577-b9da-0c810c34751b",
  "query": "flooding in western france"
}
```

## Technical Details

| File | Change |
|---|---|
| `supabase/functions/fetch-tweets/index.ts` | Replace `XAI_API_KEY` with `GROK_API_KEY` (2 occurrences) |

Single-line fix, no logic changes needed.

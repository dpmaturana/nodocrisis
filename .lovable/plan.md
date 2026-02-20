

# Update fetch-tweets to use grok-4-mini

## Problem

The `fetch-tweets` edge function uses `grok-3-mini`, which does not support the `x_search` server-side tool. The xAI API requires a grok-4 family model for this feature.

## Change

Single-line change in `supabase/functions/fetch-tweets/index.ts` (line 339):

| Before | After |
|---|---|
| `model: "grok-3-mini"` | `model: "grok-4-mini"` |

No other files or logic changes needed.

## Verification

After deploy, test by calling:

```text
POST /fetch-tweets
{ "event_id": "22dba5aa-...", "query": "flooding in western france" }
```

Expected: 200 response with aggregated tweet signals instead of a 502 model error.


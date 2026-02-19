

# Fetch Tweets via Grok API + Fix Build Errors

## 1. Fix Existing Build Errors (3 changes)

### `src/components/sectors/SectorDetailDrawer.tsx`
Remove the `population_affected` references (lines 236-252). The `EnrichedSector` type doesn't have this property. Replace with just the `context.estimatedAffected` fallback, or remove the section entirely.

### `src/services/sectorService.ts`
The `CapacityType` in `src/types/database.ts` requires `criticality_level`, but the DB `capacity_types` table doesn't have that column. Two options:
- **Option A (recommended)**: Make `criticality_level` optional in the type (`criticality_level?:`) since the DB doesn't have it.
- **Option B**: Add the column to the DB.

We'll go with Option A: change `criticality_level` to optional in `src/types/database.ts`, which fixes the cast error in `sectorService.ts`.

## 2. Add XAI API Key Secret

The Grok API requires an API key from xAI (https://console.x.ai). We'll prompt you to add a `XAI_API_KEY` secret before deploying the edge function.

## 3. Create `fetch-tweets` Edge Function

A new edge function at `supabase/functions/fetch-tweets/index.ts` that:

1. Accepts: `{ event_id, query, sector_id? }`
2. Calls the xAI Responses API (`https://api.x.ai/v1/responses`) with the `x_search` tool to find relevant tweets
3. Parses the tweet results into the existing `TweetInput` format
4. Runs the deterministic classification from `tweetSignalAggregation.ts` (inlined in the edge function since it can't import from `src/`)
5. Stores results as `signals` in the database
6. Returns the aggregated signal

### API Details

The xAI Responses API with `x_search` tool:

```text
POST https://api.x.ai/v1/responses
Authorization: Bearer $XAI_API_KEY

{
  "model": "grok-3-mini",
  "tools": [{ "type": "x_search" }],
  "input": "Find recent tweets about [query] related to emergency/crisis"
}
```

The response contains tweet content in the assistant's message, which we'll parse and classify.

### Edge Function Flow

```text
Request --> Auth check --> Call xAI x_search --> Parse tweets
  --> Classify (regex-based, same as tweetSignalAggregation.ts)
  --> Store signals in DB --> Return aggregated result
```

## 4. Register in `supabase/config.toml`

```toml
[functions.fetch-tweets]
verify_jwt = false
```

## Files Changed

| File | Change |
|---|---|
| `src/components/sectors/SectorDetailDrawer.tsx` | Remove `population_affected` references |
| `src/types/database.ts` | Make `criticality_level` optional |
| `supabase/functions/fetch-tweets/index.ts` | New edge function for xAI tweet fetching |
| `supabase/config.toml` | Register new function |


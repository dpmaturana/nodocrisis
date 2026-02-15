

# Create `collect-news-context` Edge Function

## Overview

Create the edge function file at `supabase/functions/collect-news-context/index.ts` that calls the xAI Grok API to search X (Twitter) for emergency-related tweets and return structured results.

## Prerequisites

- An `XAI_API_KEY` secret is needed. I will prompt you to enter it before the function can work.

## What Will Be Created

### File: `supabase/functions/collect-news-context/index.ts`

The function will:
- Accept a POST request with a `query` string (e.g., "incendios forestales Chile") and optional `max_results`
- Call the xAI API (`grok-3-mini` model) with a system prompt that instructs Grok to search X for relevant tweets
- Return structured JSON with tweet data (author, text, date, metrics, relevance) and a summary
- Handle CORS, OPTIONS preflight, and error cases (missing key, API errors)

### Config: `supabase/config.toml`
- Will be auto-updated with the new function entry

## Technical Details

- Follows the same CORS pattern as existing edge functions (`generate-situation-report`, etc.)
- Uses `Deno.env.get("XAI_API_KEY")` for auth with the xAI API
- Model: `grok-3-mini` with temperature 0.3 for structured output
- `verify_jwt = false` in config to allow flexible access

## Steps

1. Prompt you to add the `XAI_API_KEY` secret
2. Create `supabase/functions/collect-news-context/index.ts`
3. Deploy and test with a sample query


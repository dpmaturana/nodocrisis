

# Create `collect-news-context` Edge Function

## Overview

Create a new backend function at `supabase/functions/collect-news-context/index.ts` that uses the xAI Grok API to search and extract tweets from X (Twitter) about emergencies. Grok has native access to real-time X data.

## Prerequisites

You will need an **xAI API key** from [console.x.ai](https://console.x.ai). I will prompt you to enter it as a secure secret (`XAI_API_KEY`) before proceeding.

## What Will Be Created

### 1. Secret: `XAI_API_KEY`
- Prompt you to add the xAI API key

### 2. Edge Function: `supabase/functions/collect-news-context/index.ts`

The function will:
- Accept a `query` string (e.g., "incendios forestales Chile") and optional `max_results` parameter
- Call the xAI API at `https://api.x.ai/v1/chat/completions` using the `grok-3-mini` model
- Use a system prompt instructing Grok to search X for relevant tweets and return structured JSON
- Return an array of extracted tweet objects with: author, text, date, engagement metrics, relevance score
- Handle CORS, error codes (429, 402), and JSON parsing

**Response structure:**
```json
{
  "success": true,
  "query": "incendios forestales Chile",
  "tweets": [
    {
      "author": "@username",
      "text": "Tweet content...",
      "date": "2026-02-15",
      "metrics": { "likes": 120, "retweets": 45 },
      "relevance": 0.9
    }
  ],
  "summary": "Brief AI-generated summary of the tweet landscape",
  "collected_at": "2026-02-15T..."
}
```

### 3. Config: `supabase/config.toml` update
- Add `[functions.collect-news-context]` with `verify_jwt = false`

## Technical Details

- Follows the same CORS and error-handling patterns as the existing `generate-situation-report` function
- Uses `Deno.env.get("XAI_API_KEY")` for authentication
- Model: `grok-3-mini` (cost-effective for search tasks)
- Temperature: 0.3 (structured output)
- System prompt instructs Grok to use its live X search capability and return only valid JSON

## Files

| File | Action |
|------|--------|
| `supabase/functions/collect-news-context/index.ts` | Create |
| `supabase/config.toml` | Auto-updated (add function entry) |

## Steps

1. Request `XAI_API_KEY` secret from you
2. Create the edge function
3. Deploy and test with a sample query


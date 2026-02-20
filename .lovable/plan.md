

# Store Twitter Bearer Token and Rewrite fetch-tweets

## Step 1: Store the Secret
Save `TWITTER_BEARER_TOKEN` as a backend secret so the edge function can authenticate with the Twitter/X API v2.

## Step 2: Rewrite `supabase/functions/fetch-tweets/index.ts`

Replace the xAI/Grok API call and the `parseTweetsFromResponse` prose-splitting function with two new functions that use the official Twitter API:

- **`fetchRecentTweets(query, bearerToken)`** -- Calls `GET https://api.x.com/2/tweets/search/recent` with:
  - `tweet.fields=created_at,public_metrics,author_id`
  - `expansions=author_id`
  - `user.fields=username`
  - `max_results=20`

- **`mapApiTweetsToInput(apiResponse)`** -- Converts the structured JSON into `TweetInput[]` using real tweet IDs, real author handles (from `includes.users`), real timestamps, and real engagement metrics.

Everything else stays the same: classification patterns, `classifyTweet()`, `aggregateTweetSignals()`, CORS headers, signal storage logic, and error handling.

## What Changes in the File

| Removed | Added |
|---------|-------|
| `parseTweetsFromResponse()` function | `fetchRecentTweets()` function |
| xAI/Grok API call block | `mapApiTweetsToInput()` function |
| `GROK_API_KEY` reference | `TWITTER_BEARER_TOKEN` reference |

## Data Mapping

```text
Twitter v2 field              ->  TweetInput field
────────────────────────────────────────────────────
data[].id                     ->  tweet_id
includes.users[].username     ->  author_handle
data[].created_at             ->  created_at
data[].text                   ->  text
public_metrics.retweet_count  ->  retweet_count
public_metrics.reply_count    ->  reply_count
```

## No Other Changes Needed
- `supabase/config.toml` stays the same
- Classification, aggregation, and signal storage pipeline is unchanged
- The `GROK_API_KEY` secret remains available for other functions that use it


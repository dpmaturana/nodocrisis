

## Add SERPAPI_KEY Secret

### What
Store the SerpAPI API key as a secure backend secret so the `collect-news-context` edge function can use it.

### Steps
1. Use the secure secret storage tool to prompt you to enter your SERPAPI_KEY value
2. Verify the secret is available by checking the secrets list

### Technical Detail
- The `collect-news-context` function already reads `SERPAPI_KEY` via `Deno.env.get("SERPAPI_KEY")` -- no code changes needed
- The secret will be encrypted and available to all backend functions automatically


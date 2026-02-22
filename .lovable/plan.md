

# Remove Language Fallback in collect-news-context

## Problem
The line in `collect-news-context/index.ts`:
```
const hl = (lang ?? (gl === "us" ? "en" : "es")).toLowerCase();
```
has a hardcoded US-centric fallback that defaults non-US countries to Spanish. This is unnecessary because the upstream `create-initial-situation-report` function already uses the LLM to detect the correct language and passes it as the `lang` parameter.

## Fix
Replace that line with a simple pass-through that uses `lang` directly, falling back to `gl` (the country code itself) if `lang` is somehow missing -- since Google will interpret `hl=gr` reasonably:

```typescript
const hl = (lang ?? gl).toLowerCase();
```

## File to modify
- `supabase/functions/collect-news-context/index.ts` -- line ~89, replace the hardcoded US/ES fallback with `lang ?? gl`

This is a one-line change. The LLM is already doing the language detection upstream, so this function should just trust whatever it receives.


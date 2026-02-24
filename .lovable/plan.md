

## One-line fix: don't populate `notes.description` at creation time

**File: `src/services/situationReportService.ts`** — line ~193

Change:
```ts
description: report.summary ?? null,
```
to:
```ts
description: null,
```

This is the only change. Everything else stays exactly as-is — the resolution logic in `gapService.ts`, the UI guards, the field report pipeline that later populates `notes.description` with real observations.


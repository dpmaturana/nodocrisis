

# Fix Build Errors and Improve Edge Function

## 1. Fix Build Errors (4 files)

### `src/pages/admin/SituationReport.tsx`
Add `latitude: null, longitude: null` to the new sector objects in `handleAddSector` and `handleDuplicateSector`.

### `src/services/mock/generators.ts`
Add `latitude: null, longitude: null` to each generated `SuggestedSector`.

### `src/services/situationReportService.ts`
- Cast `level` to `"critical" | "high" | "medium" | "low"` before inserting into `sector_needs_context`.
- Cast `newsContext` to `any` before accessing `.snippets`.

## 2. Preserve Sector Coordinates in Edge Function

In `supabase/functions/create-initial-situation-report/index.ts`, the validation step (lines 346-351) currently outputs only `name`, `description`, `confidence`, and `include` -- dropping `latitude` and `longitude` that the LLM returns.

**Fix**: Include `latitude` and `longitude` in the validated sector object:
```typescript
suggested_sectors: safeArray(parsed.suggested_sectors).map((s) => ({
  name: s.name || "Unknown sector",
  description: s.description || "",
  latitude: typeof s.latitude === "number" ? s.latitude : null,
  longitude: typeof s.longitude === "number" ? s.longitude : null,
  confidence: clamp01(s.confidence, 0.5),
  include: s.include !== false,
})),
```

## 3. Fetch Capabilities Dynamically (Optional Improvement)

Instead of hardcoding the 17 capability names in the prompt, fetch them from the `capacity_types` table at runtime and inject them into the prompt. This ensures the LLM always uses the current taxonomy.

**Current** (hardcoded in prompt):
```
"Drinking water","Food supply","Storage", ...
```

**Proposed** (dynamic):
```typescript
const { data: capTypes } = await supabaseAdmin
  .from("capacity_types")
  .select("name");
const capList = capTypes?.map(c => `"${c.name}"`).join(",") ?? "";
```
Then inject `capList` into the SYSTEM_PROMPT template.

## Files Changed

| File | Change |
|---|---|
| `src/pages/admin/SituationReport.tsx` | Add `latitude: null, longitude: null` to new sector objects |
| `src/services/mock/generators.ts` | Add `latitude: null, longitude: null` to generated sectors |
| `src/services/situationReportService.ts` | Fix `level` type cast; fix `snippets` access via `any` cast |
| `supabase/functions/create-initial-situation-report/index.ts` | Preserve lat/lng in validated sectors; optionally fetch capabilities dynamically |


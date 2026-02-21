

## Fix trend derivation and initial status tracking

### Bug 1: "Worsening" shown instead of "Improving"

**Root cause**: In `src/services/gapService.ts`, the `STATUS_RANK` map ranks GREEN(1) higher than WHITE(0). Since higher rank = more severe, a transition from WHITE to GREEN is classified as "worsening". But GREEN (stabilized) is actually the best state -- it should have rank 0.

**Fix** (`src/services/gapService.ts`, line 50-52):

Change:
```
WHITE: 0, GREEN: 1, YELLOW: 2, ORANGE: 3, RED: 4
```
To:
```
GREEN: 0, WHITE: 1, YELLOW: 2, ORANGE: 3, RED: 4
```

This makes any transition toward GREEN correctly show as "Improving".

### Bug 2: Previous status hardcoded to WHITE instead of reading actual state

**Root cause**: In `supabase/functions/process-field-report-signals/index.ts`, line 547, the `previous_status` in the audit record is always hardcoded to `"WHITE"`. It should read the current `level` from `sector_needs_context` before upserting, so the audit trail accurately reflects the real transition (e.g., ORANGE to GREEN, not WHITE to GREEN).

**Fix** (`supabase/functions/process-field-report-signals/index.ts`):

Before the upsert (around line 507), query the existing row:
```typescript
const { data: existingNeed } = await supabase
  .from("sector_needs_context")
  .select("level")
  .eq("event_id", event_id)
  .eq("sector_id", sector_id)
  .eq("capacity_type_id", capId)
  .maybeSingle();

const previousNeedLevel = existingNeed?.level ?? "medium";
```

Then use a helper to map that level back to a NeedStatus for the audit:
```typescript
function mapNeedLevelToStatus(level: string): string {
  switch (level) {
    case "critical": return "RED";
    case "high":     return "ORANGE";
    case "medium":   return "YELLOW";
    case "low":      return "GREEN";
    default:         return "WHITE";
  }
}
```

And replace line 547:
```typescript
previous_status: mapNeedLevelToStatus(previousNeedLevel),
```

### Files changed

1. `src/services/gapService.ts` -- fix STATUS_RANK ordering (swap WHITE and GREEN)
2. `supabase/functions/process-field-report-signals/index.ts` -- read actual previous status from DB before writing audit


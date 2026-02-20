

## Fix remaining issues after engine validation

The `classifyItemState` refactor is working: 4 out of 5 capabilities were correctly evaluated. Two issues remain.

### Fix 1: Synthesize signals for item-less reports

**File**: `supabase/functions/process-field-report-signals/index.ts`

When a field report has `items=[]` but the LLM explicitly listed capabilities in `capability_types`, the engine currently skips evaluation. We need to generate a synthetic signal from `extracted_data.observations` using a heuristic to classify the observation text as STABILIZATION or INSUFFICIENCY based on English keywords.

In the `itemsByCapId` loop, after building signals from items, if `signals.length === 0` and the capability was explicitly named:
- Check `observations` for stabilization keywords ("stable", "sufficient", "resolved", "available", "okay", "no emergency")
- If stabilization keywords found: synthetic signal with state=`available`, confidence from `extracted_data.confidence`
- Otherwise: synthetic signal with state=`needed`, default confidence 0.5 (safe escalation)

This ensures "people are okay" reports properly downgrade capabilities.

### Fix 2: Build error in materialize-event-needs

**File**: `supabase/functions/materialize-event-needs/index.ts` (line 135-138)

Cast `err` as `Error`:
```typescript
const message = err instanceof Error ? err.message : "Internal error";
```

### Fix 3: Add engine reasoning to notes

**File**: `supabase/functions/process-field-report-signals/index.ts`

Update the `notes` field in the `sector_needs_context` upsert to include engine reasoning alongside operational requirements:
- Format: `"[ENGINE] insuff=X stab=Y → STATUS → level | [OPS] ambulances (critical)"`
- This provides traceability without needing a separate audit table

### Deployment sequence

1. Fix build error in `materialize-event-needs`
2. Add synthetic signal logic and reasoning notes to `process-field-report-signals`
3. Both functions auto-deploy
4. Re-process Report 3 (ff7d3718) to verify the "people are okay" observation correctly evaluates

### Technical details

**Synthetic signal classification** will use this function:
```typescript
function classifyObservation(text: string): "available" | "needed" {
  const stabPatterns = /\b(stable|sufficient|resolved|available|okay|ok|covered|no.*(emergency|need|shortage))\b/i;
  return stabPatterns.test(text) ? "available" : "needed";
}
```

**Reasoning format** in notes:
```
[ENGINE] insuff=1.00 stab=0.00 demand=0.00 cov=0.00 frag=0.00 → RED → critical | [OPS] ambulances (critical)
```


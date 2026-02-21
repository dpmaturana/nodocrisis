

## Fix: Persist engine results so reports actually update dashboard status

### What's broken

Reports and signals save correctly to the database, but the calculated status never updates `sector_needs_context` because:

1. **Observation-only reports are skipped**: When `items` is empty (like "no injuries"), the edge function `process-field-report-signals` never runs the engine for that capability
2. **Engine results aren't persisted from deployments**: `deploymentService.ts` runs the engine but discards the result (fire-and-forget `.catch()`)
3. **Missing `need_audits` table**: Code references it everywhere but it doesn't exist, causing build errors
4. **Plain-text notes break pill rendering**: `gapService.ts` does `JSON.parse()` on plain text and fails silently

### Fix 1: Create `need_audits` table (database migration)

Create the table the codebase already references. Columns:
- id (uuid, PK), sector_id, capability_id, event_id (all uuid)
- timestamp (timestamptz), previous_status, proposed_status, final_status (text)
- llm_confidence (numeric), reasoning_summary (text)
- contradiction_detected (boolean), key_evidence (text[])
- legal_transition (boolean), illegal_transition_reason (text)
- guardrails_applied (text[]), scores_snapshot (jsonb), booleans_snapshot (jsonb)
- model (text), prompt_version (text), config_snapshot (jsonb)

RLS: admin ALL, authenticated SELECT.

### Fix 2: Synthetic signals for observation-only reports

**File**: `supabase/functions/process-field-report-signals/index.ts`

When a capability is explicitly named in `capability_types` but has no matching items, generate a synthetic signal from the `observations` text:

```text
function classifyObservation(text: string): "available" | "needed" {
  const stabPatterns = /\b(stable|sufficient|resolved|available|okay|ok|
    covered|healthy|no.*(injury|injuries|emergency|need|shortage)|
    recovering|good)\b/i;
  return stabPatterns.test(text) ? "available" : "needed";
}
```

- If classified as "available": signal content = "observation: stable, operando estable", confidence from extracted_data.confidence
- If classified as "needed": signal content = "observation: needed, no alcanza", confidence = 0.5

This ensures "no injuries" reports generate stabilization signals that move the status toward GREEN.

### Fix 3: Persist engine results from deployments

**File**: `src/services/deploymentService.ts`

Replace all fire-and-forget `.catch()` calls to `onDeploymentStatusChange` with proper `await` + upsert:

```typescript
const needState = await needSignalService.onDeploymentStatusChange({
  eventId, sectorId, capabilityId, deploymentStatus, actorName, previousStatus
});
if (needState) {
  const newLevel = mapNeedStatusToNeedLevel(needState.current_status);
  await supabase
    .from("sector_needs_context")
    .upsert({
      event_id: eventId,
      sector_id: sectorId,
      capacity_type_id: capabilityId,
      level: newLevel,
      source: "deployment",
    }, { onConflict: "event_id,sector_id,capacity_type_id" });
}
```

Applies to: `enroll`, `updateStatus`, `updateStatusWithNote`, `markAsOperating`.

### Fix 4: Resilient pill parsing

**File**: `src/services/gapService.ts` (line ~208)

Change from swallowing parse errors to wrapping plain text:

```typescript
if (!need.notes) return [];
try {
  const parsed = JSON.parse(need.notes);
  return Array.isArray(parsed) ? parsed : [need.notes];
} catch {
  return [need.notes];
}
```

### Fix 5: Store notes as JSON arrays going forward

In the edge function, always write notes as `JSON.stringify([...items])` so future reads parse cleanly.

### Fix 6: TypeScript error fixes

- `supabase/functions/materialize-event-needs/index.ts`: cast `err` as `Error` in catch block
- `src/services/activityLogService.ts`: cast audit query results through `unknown`

### Expected results after fix

- The 3 existing "no injuries" reports for La Rochelle will trigger GREEN/low on re-processing
- Marking "interested" or "operating" in Vendee will update the dashboard color immediately
- Existing plain-text notes will render as pills
- All build errors resolved

### Files changed

- Database migration (new `need_audits` table)
- `supabase/functions/process-field-report-signals/index.ts` (synthetic signals, JSON notes)
- `supabase/functions/materialize-event-needs/index.ts` (error cast)
- `src/services/deploymentService.ts` (persist engine results)
- `src/services/gapService.ts` (resilient parser)
- `src/services/activityLogService.ts` (type casts)

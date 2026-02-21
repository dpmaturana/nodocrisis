

## Remove reasoning from expandable card, keep only in Activity Log + make it human-readable

### Change 1: Remove reasoning_summary from expandable (SectorStatusChip)

**File: `src/components/dashboard/SectorStatusChip.tsx`**

- Remove lines 69-72 (the `reasoning_summary` paragraph in the expanded section)
- Update line 34: change `hasExpandableContent` to only check `requirements.length > 0` (remove `!!gap.reasoning_summary` from the condition)
- The expandable chevron will only appear when there are operational requirements to show

### Change 2: Make reasoning_summary human-readable (edge function + client)

The reasoning still displays in the Activity Log modal. Replace the debug string with clear sentences.

**File: `supabase/functions/process-field-report-signals/index.ts`**

Add a `buildHumanReasoning(scores, booleans, finalStatus, guardrails)` helper that produces sentences like:

- RED: "High insufficiency detected with no active coverage."
- ORANGE: "Demand or insufficiency signals present but coverage is active."
- YELLOW: "Coverage activity detected, pending validation."
- GREEN: "Stabilization signals strong with no alerts."
- WHITE: "No significant signals detected."

Guardrails get appended as: "Safety rule: [explanation]."

Replace the current debug template string with a call to this helper.

**File: `src/services/needSignalService.ts`**

Apply the same human-readable pattern to the client-side engine reasoning output.

### Result

- The expandable section on the card only shows operational requirements (the rounded chips)
- The Activity Log modal continues to show reasoning, but now as readable English sentences instead of raw scores

### Files changed

1. `src/components/dashboard/SectorStatusChip.tsx` -- remove reasoning_summary from expandable
2. `supabase/functions/process-field-report-signals/index.ts` -- add buildHumanReasoning helper
3. `src/services/needSignalService.ts` -- human-readable client-side reasoning

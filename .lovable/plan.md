

## Problem

When a field report mentions multiple capabilities with different statuses (e.g., "Debris has been successfully removed. Temporary tents are now needed for shelter"), the system treats ALL capabilities the same because:

1. The extraction prompt produces a single flat `observations` summary and a flat `items[]` list shared across all capabilities
2. The signal processor assigns the same observation text and mismatched items to every capability
3. The need evaluator cannot distinguish which evidence applies to which capability

This causes debris removal (which improved) to worsen, and shelter (which worsened) to get mixed signals.

## Solution: Per-Capability Extraction

Restructure the LLM extraction to produce **per-capability** signal data, so each capability gets its own items, observation, and evidence.

### Step 1: Update the extraction prompt (`extract-text-report/index.ts`)

Change the output schema from a flat structure to one that groups data by capability:

```text
Current: { capability_types: ["debris removal", "shelter"], items: [...flat...], observations: "single summary" }

New:     { capabilities: [
            { name: "debris removal", sentiment: "improving", items: [...], observation: "...", evidence_quotes: [...] },
            { name: "shelter", sentiment: "worsening", items: [...], observation: "...", evidence_quotes: [...] }
          ],
          observations: "overall summary",
          confidence: 0.85
        }
```

Each capability entry includes:
- `name`: exact capability name from the system list
- `sentiment`: "improving" | "worsening" | "stable" | "unknown"
- `items`: only items relevant to THIS capability
- `observation`: capability-specific summary
- `evidence_quotes`: relevant quotes for THIS capability

The top-level `observations` remains as a general summary. `capability_types` is kept for backward compatibility (derived from the `capabilities` array).

### Step 2: Update signal creation in `extract-text-report/index.ts`

When creating signals in the `signals` table, use each capability's specific `observation` as the signal `content` instead of the shared global one. This makes each signal record accurately describe what happened for that specific capability.

### Step 3: Update `process-field-report-signals/index.ts`

- Accept the new `capabilities` array from `extracted_data`
- When the new format is present, use each capability's own items, observation, and evidence for evaluation -- no more substring matching or fallback assignment
- Pass the capability-specific `observation` and `evidence_quotes` to `evaluateNeedStatusWithLLM()` instead of the shared ones
- Keep backward compatibility: if `capabilities` array is absent, fall back to the existing flat logic

### Step 4: Pass per-capability context to the LLM evaluator

In the `evaluateNeedStatusWithLLM` call inside the processing loop, use the capability-specific observation and evidence quotes rather than the global ones. This ensures the need evaluator only sees evidence relevant to the capability being evaluated.

## Expected Outcome

With the report "Debris has been successfully removed. Temporary tents are now needed to provide shelter for affected individuals":

- **Debris removal**: Gets stabilization signals, observation = "Debris cleared successfully" -- status improves toward GREEN
- **Shelter**: Gets demand/insufficiency signals, observation = "Temporary tents urgently needed" -- status worsens toward RED/ORANGE

## Technical Details

### Files Modified
1. `supabase/functions/extract-text-report/index.ts` -- Updated extraction prompt and signal creation
2. `supabase/functions/process-field-report-signals/index.ts` -- Per-capability processing path

### Backward Compatibility
The new `capabilities` field is additive. The flat `capability_types` and `items` arrays remain populated (derived from the per-capability data) so existing code paths continue working. The signal processor checks for the presence of `capabilities` array and uses the new path when available, falling back to the old logic otherwise.

### No Database Changes Required
No migrations needed -- the `extracted_data` column is already JSONB, and the `signals` table already supports per-capability entries.


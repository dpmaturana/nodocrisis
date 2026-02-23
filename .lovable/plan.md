

# Fix Misleading Activity Log When Status Doesn't Change

## Problem
When the system re-evaluates a need status and guardrails block the LLM's proposed transition, the activity log shows confusing results like "Critical -> Critical" while the reasoning says "leading to an ORANGE status." The reasoning text reflects what the LLM *wanted* to do, not what actually happened.

## Root Cause
The backend already appends a guardrail override note (e.g., `[Transition overridden by: Guardrail A. Final status: RED.]`) to the reasoning -- but older audit records were written before this fix existed, so they lack the clarification. On the frontend, there's no visual distinction between an actual status change and a "re-evaluated but unchanged" entry.

## Solution

### 1. Frontend -- Annotate no-op status changes (ActivityLogModal.tsx)

When `previous_status === final_status`:
- Still show the status dot and label (single, not an arrow transition)
- Add a "(re-evaluated, no change)" annotation in muted text
- The reasoning block continues to display as-is, which now provides context

When `previous_status !== final_status`:
- Keep the existing arrow transition display unchanged

### 2. Backend -- Improve reasoning for no-op results (evaluateNeedStatusWithLLM.ts)

After guardrails produce a `finalStatus` that equals `prevStatus`, and the LLM had proposed something different, replace the reasoning suffix with a clearer explanation:

Instead of: `[Transition overridden by: Guardrail A. Final status: RED.]`
Use: `However, safety rules prevented this change (Guardrail A: demand is strong with no coverage). Status remains RED.`

This reuses the same `GUARDRAIL_EXPLANATIONS` map from `evaluateNeedStatus.ts` to produce human-readable text.

## Technical Details

### File: `src/components/dashboard/ActivityLogModal.tsx`

In the `ActivityLogItem` component (around line 169-188):

- Add detection: `const isNoOp = entry.previous_status === entry.final_status;`
- When `showStatusTransition && isNoOp`: render a single status dot + label + "(re-evaluated, no change)" instead of `StatusTransition`
- When `showStatusTransition && !isNoOp`: keep existing `StatusTransition` arrow

### File: `supabase/functions/_shared/evaluateNeedStatusWithLLM.ts`

In the reasoning construction (around line 388-392):

- When `finalStatus === prevStatus` and the LLM proposed something different, build a more descriptive override message using human-readable guardrail explanations
- Add a `GUARDRAIL_EXPLANATIONS` map (same content as in `evaluateNeedStatus.ts`) to translate guardrail codes into plain language
- New format: `"<LLM reasoning>. However, safety rules prevented this change (<explanation>). Status remains <STATUS>."`


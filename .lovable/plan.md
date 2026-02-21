

## Fix: Status changes always showing "from Monitoring (WHITE)"

### Problem
In `supabase/functions/process-field-report-signals/index.ts` line 547, the `previous_status` is **hardcoded to `"WHITE"`**:

```typescript
previous_status: "WHITE",
```

This means every `need_audits` row (and therefore every Activity Log status change entry) shows the transition starting from WHITE/Monitoring, regardless of the gap's actual current status.

### Fix

**File: `supabase/functions/process-field-report-signals/index.ts`**

Before the evaluation loop (where gaps are iterated), fetch the **current `need_status`** from `sector_needs_context` for the given sector + event + capability. Use that as `previous_status` when inserting into `need_audits`.

Steps:
1. Before the per-capability loop, query `sector_needs_context` for the current sector to get existing need levels
2. Inside the loop, look up the current status for each capability from that query result
3. Map the stored `need_level` back to a `NeedStatus` using the existing mapping (critical=RED, high=ORANGE, medium=YELLOW, low=GREEN, default=WHITE)
4. Use this looked-up status as `previous_status` on line 547 instead of the hardcoded `"WHITE"`
5. Also pass it as the starting state for the engine evaluation so the transition legality check works correctly

### What changes
- Only `supabase/functions/process-field-report-signals/index.ts` is modified
- A single query is added before the capability loop to fetch current statuses
- Line 547 uses the real previous status
- Edge function redeployment is automatic

### Result
The Activity Log will correctly show transitions like "Critical -> Validating" instead of always "Monitoring -> Validating".


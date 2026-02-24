

## Fix: Stop falling back to audit `reasoning_summary` when note description is null

### Problem

In `src/services/deploymentService.ts` (lines 207-209), when a `sector_needs_context` row has no `description` (which we just cleaned), the code falls back to the latest `need_audits.reasoning_summary`. That audit reasoning is the LLM's internal evaluation rationale — not the field-facing note description. The NGO sees text like "Based on SMS signal confidence 0.7…" instead of nothing.

### Fix

**File: `src/services/deploymentService.ts`** — Remove the audit reasoning fallback (lines 207-209).

Delete these lines:
```ts
if (!reasoning_summary) {
  reasoning_summary = stripGuardrailSuffix(auditMap.get(dep.capacity_type_id)!);
}
```

This means `reasoning_summary` will only populate when `notes.description` contains actual field evidence. The requirement pills will still show. No other changes needed.


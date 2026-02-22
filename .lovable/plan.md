

## Remove Redundant Guardrails Line

### Why
The `reasoning_summary` field already contains a human-readable explanation for every applied guardrail (e.g. "Safety rule: insufficiency is strong with no coverage, escalated to Critical."). The separate "Guardrails: Guardrail B" line below it is redundant and confusing.

### Change

**`src/components/dashboard/ActivityLogModal.tsx`**
- Remove the guardrails paragraph (the `{entry.guardrails_applied && ...}` block, approximately lines 199-204) inside the reasoning `<div>`
- Keep the reasoning summary text as-is -- it already explains everything

This is a single small deletion. No backend changes needed.


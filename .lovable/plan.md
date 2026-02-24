

## Show Signal Summary in NGO Deployment Cards

### Problem
The NGO deployment view (`CapabilityRow`) currently shows `reasoning_summary` which falls back to `need_audits.reasoning_summary` — text containing internal guardrail mechanics like "Transition overridden by: Guardrail B. Final status: RED." The user wants NGOs to see the clean signal summary (e.g., "New shelter facilities are urgently needed to accommodate over 100 people.") — the same text visible in the admin's expandable row.

### Root Cause
- Only 2 of 17 `sector_needs_context` records have a meaningful `notes.description`. The rest were either cleaned or never had one.
- When `notes.description` is null, the code falls back to `need_audits.reasoning_summary`, which includes guardrail override text.

### Changes

**`src/services/deploymentService.ts`**

1. Add a helper function to strip guardrail suffixes from audit reasoning:
```ts
function stripGuardrailSuffix(text: string): string {
  const markers = [
    ". Transition overridden by:",
    ".. Transition overridden by:",
    ". However, safety rules prevented this change",
  ];
  for (const marker of markers) {
    const idx = text.indexOf(marker);
    if (idx > 0) return text.substring(0, idx) + ".";
  }
  return text;
}
```

2. Apply `stripGuardrailSuffix` when reading `reasoning_summary` from the audit map fallback (~line 195), and also when reading from `parsed.description` (~line 184) for safety.

This ensures:
- Records with a meaningful `notes.description` (like "New shelter facilities...") show that text as-is
- Records falling back to `need_audits` show clean summaries like "Demand is strong and insufficiency is validated, with no active coverage, indicating a critical unmet need." without the guardrail suffix

### Impact
- NGO actors see clean, actionable summaries matching what admins see
- Full guardrail reasoning preserved in the database for admin Activity Log
- No database or edge function changes needed


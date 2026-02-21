

## Store plain-language descriptions in the notes field

### Changes

Three files need updating to standardize `notes` as a JSON object `{ requirements: [...], description: "..." }`.

### Technical details

**1. Edge function: `supabase/functions/process-field-report-signals/index.ts` (lines 539-545)**

Change the `notes` value from a plain JSON array to a JSON object with both requirements and the reporter's observations:

```typescript
// Before:
notes: JSON.stringify(
  operationalRequirements.length > 0
    ? operationalRequirements
    : extracted_data.observations
      ? [extracted_data.observations]
      : []
),

// After:
notes: JSON.stringify({
  requirements: operationalRequirements.length > 0
    ? operationalRequirements
    : [],
  description: extracted_data.observations ?? null,
}),
```

**2. Service: `src/services/situationReportService.ts` (lines 187-193)**

Add `notes` with description from the report summary when creating needs:

```typescript
// Before:
needsToInsert.push({
  event_id: newEventId,
  sector_id: sectorId,
  capacity_type_id: ct.id,
  level,
  source: "situation_report",
});

// After:
needsToInsert.push({
  event_id: newEventId,
  sector_id: sectorId,
  capacity_type_id: ct.id,
  level,
  source: "situation_report",
  notes: JSON.stringify({
    requirements: [],
    description: report.summary ?? null,
  }),
});
```

**3. Service: `src/services/gapService.ts` (lines 207-227)**

Update parsing to handle the new JSON object format plus backwards compatibility:

```typescript
operational_requirements: (() => {
  if (!need.notes) return [];
  try {
    const parsed = JSON.parse(need.notes);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return Array.isArray(parsed.requirements) ? parsed.requirements : [];
    }
    if (Array.isArray(parsed)) return parsed; // legacy
    return [];
  } catch { return []; }
})(),
reasoning_summary: (() => {
  if (need.notes) {
    try {
      const parsed = JSON.parse(need.notes);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && typeof parsed.description === "string") {
        return parsed.description;
      }
    } catch {
      return need.notes; // legacy plain text
    }
  }
  return auditMap.get(`${need.sector_id}:${need.capacity_type_id}`);
})(),
```

### Files changed

1. `supabase/functions/process-field-report-signals/index.ts` -- store notes as `{ requirements, description }` JSON object
2. `src/services/situationReportService.ts` -- include description from report summary when creating needs
3. `src/services/gapService.ts` -- parse new JSON object format with backwards compatibility

### Migration note
Existing rows with old formats (plain JSON arrays or plain text) continue to work due to backwards-compatible parsing. New data will use the new format going forward.


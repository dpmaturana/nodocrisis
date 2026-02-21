

## Show the right description under each need row

### Problem
The `notes` field in `sector_needs_context` has two formats:
- Plain text descriptions like `"Additional human resources are critically needed for search and rescue operations as people are reported trapped."` (Search and rescue)
- JSON arrays like `["water (high)"]` (Drinking water)

Currently, the code uses `reasoning_summary` from `need_audits` as the description line, but that always contains status-change explanations (e.g. "High insufficiency detected with no active coverage..."), not the contextual description the user wants.

The actual descriptive text lives in the `notes` field when it's a plain string.

### Solution
Update the data mapping in `gapService.ts` to separate `notes` into two fields properly:
- `operational_requirements`: only populated when `notes` is a JSON array
- `reasoning_summary`: populated from the `notes` field when it's a plain string (not JSON), falling back to the audit reasoning only if notes has no plain text

### Technical details

**File: `src/services/gapService.ts` (lines ~207-216)**

Change the mapping logic when building `GapWithDetails`:

```typescript
// Parse notes: if JSON array -> requirements, if plain string -> description
const parsedNotes = (() => {
  if (!need.notes) return { requirements: [], description: undefined };
  try {
    const parsed = JSON.parse(need.notes);
    if (Array.isArray(parsed)) return { requirements: parsed as string[], description: undefined };
    return { requirements: [], description: need.notes };
  } catch {
    return { requirements: [], description: need.notes };
  }
})();

// Then in the object:
operational_requirements: parsedNotes.requirements,
reasoning_summary: parsedNotes.description ?? auditMap.get(...),
```

This way:
- **Search and rescue** (plain text notes): shows the description as the summary, no pills
- **Drinking water** (JSON array notes): shows `water` as a pill, and falls back to the audit reasoning for the summary line

### Files changed

1. `src/services/gapService.ts` -- update notes parsing to distinguish plain-text descriptions from JSON requirement arrays



## Problem

The "Western France Flood" event has 5 sectors in the database, but the admin dashboard shows "Sin brechas que mostrar" (no gaps to show). This is because:

1. The `gapService.getGapsGroupedBySector()` groups results by `sector_needs_context` rows, not by sectors directly
2. There are **zero** `sector_needs_context` records for this event
3. Without needs, sectors are invisible on the dashboard

This is a known architectural gap: the situation report confirmation flow creates `events` and `sectors` but does not yet create `event_context_needs` or `sector_needs_context` records.

## Plan

### Step 1 -- Seed capacity needs from the situation report data

Insert `sector_needs_context` records for each sector using the capacity types already in the `capacity_types` table. The situation report's `suggested_capabilities` JSON contains the AI-suggested needs; we will query it and use it to populate `sector_needs_context` with appropriate levels per sector.

If the situation report data is insufficient (no per-sector breakdown), we will create a reasonable default set: assign the event's suggested capability types to all sectors at `medium` or `high` level so they become visible on the dashboard.

### Step 2 -- Fix the materialization flow (longer-term)

Update the `create-initial-situation-report` or a new `materialize-event` edge function so that when a report is confirmed, it also creates `sector_needs_context` rows automatically. This prevents the problem from recurring for future events.

---

### Technical details

**Step 1 (immediate fix):**
- Query `initial_situation_reports` for the linked event to extract `suggested_capabilities`
- Query `capacity_types` to resolve capability IDs
- Insert into `sector_needs_context` one row per (sector, capacity_type) combination with `source = 'ai_suggested'` and a sensible `level` (e.g. `high` for flood-critical types)

**Step 2 (code change):**
- In the situation report confirmation handler (likely in `src/pages/admin/SituationReport.tsx` or the edge function), after inserting sectors, also insert `sector_needs_context` rows derived from `suggested_capabilities` + `suggested_sectors`
- Each suggested sector's needs array should map to `sector_needs_context` rows with the correct `capacity_type_id`, `level`, and `source = 'ai_suggested'`


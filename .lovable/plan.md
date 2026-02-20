

# Add unique constraint on sector_needs_context

## Problem

The `extract-text-report` edge function uses an upsert with `ON CONFLICT (event_id, sector_id, capacity_type_id)`, but the `sector_needs_context` table lacks a unique constraint on those columns. This causes the upsert to silently fail, so need levels never update on the dashboard after a field report.

## Change

Run a single database migration:

```sql
ALTER TABLE public.sector_needs_context
  ADD CONSTRAINT sector_needs_context_event_sector_cap_uq
  UNIQUE (event_id, sector_id, capacity_type_id);
```

This creates the unique constraint the edge function already expects. No code changes needed.

## Impact

- The `extract-text-report` function's existing upsert logic will start working correctly
- When a field report detects a need, the corresponding `sector_needs_context` row will be inserted or updated
- Dashboard gap colors will reflect the latest field report data
- No existing data is affected (duplicate rows, if any, would need to be cleaned first -- we will check before applying)

## Verification

After the migration, submit a field report from the actor view and confirm the sector need level updates on the Event Dashboard.


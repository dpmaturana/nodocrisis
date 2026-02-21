

## Real-time dashboard updates when need status changes

### What changes

When an admin submits a report or any process updates a need status in `sector_needs_context`, the dashboard will automatically refresh the sector cards without requiring a manual page reload.

### How it works

1. **Enable Realtime on `sector_needs_context`** (database migration)
   - Run: `ALTER PUBLICATION supabase_realtime ADD TABLE public.sector_needs_context;`

2. **Add Realtime subscription in `SectorGapList.tsx`**
   - Subscribe to `postgres_changes` on `sector_needs_context` filtered by `event_id`
   - On any INSERT/UPDATE/DELETE event, re-fetch the full sector gap data via `gapService.getGapsGroupedBySector(eventId)`
   - Clean up the subscription on unmount
   - Add a small debounce (500ms) so rapid batch updates don't cause excessive re-fetches

### Technical detail

```text
SectorGapList (subscribes to sector_needs_context changes)
  |-- on postgres_changes event (INSERT/UPDATE/DELETE)
  |     |-- debounce 500ms
  |     +-- re-calls gapService.getGapsGroupedBySector(eventId)
  |           |-- updates sectorsWithGaps state
  |           +-- calls onSectorsLoaded (propagates to parent for map + filters)
  |
  +-- cleanup: unsubscribe on unmount or eventId change
```

### Files changed

1. **Database migration** -- enable realtime on `sector_needs_context`
2. **`src/components/dashboard/SectorGapList.tsx`** -- add Supabase realtime subscription that triggers data re-fetch on changes


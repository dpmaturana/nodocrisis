

# Delete All Events and Related Records

## Overview
Purge all 9 events and their dependent records from the database. Deletions must happen in dependency order to avoid foreign key violations.

## What Gets Deleted

- 7 field reports
- 7 signals
- 188 sector needs (context)
- 36 sectors
- 32 initial situation reports (unlink from events)
- 9 events

## Execution Order

The SQL statements will run in this order using a database migration:

```sql
-- 1. Delete field reports (references sectors and events)
DELETE FROM field_reports;

-- 2. Delete signals (references sectors and events)
DELETE FROM signals;

-- 3. Delete sector needs context (references sectors and events)
DELETE FROM sector_needs_context;

-- 4. Delete sector needs SMS (references sectors and events)
DELETE FROM sector_needs_sms;

-- 5. Delete event context needs (references events)
DELETE FROM event_context_needs;

-- 6. Delete deployments (references sectors and events)
DELETE FROM deployments;

-- 7. Delete sectors (references events)
DELETE FROM sectors;

-- 8. Unlink and optionally delete situation reports
UPDATE initial_situation_reports SET linked_event_id = NULL;
DELETE FROM initial_situation_reports;

-- 9. Delete events
DELETE FROM events;
```

All statements use unconditional `DELETE` (no WHERE clause) since the request is to remove everything.

## Notes
- This only affects the **Test** environment database
- No code changes are needed
- Mock/in-memory data used by the frontend is unaffected (it lives in `src/services/mock/data.ts`)

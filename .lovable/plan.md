

## Clean up: null out initial descriptions that were never updated

### Data analysis

- All rows with `source = 'situation_report'` have the same generic description from creation — these should be cleaned
- The one row with `source = 'field_report'` has a real observation ("Three ambulances are urgently needed...") — this should be kept

### SQL to run

```sql
UPDATE sector_needs_context
SET notes = jsonb_set(notes::jsonb, '{description}', 'null'::jsonb)::text
WHERE source = 'situation_report'
  AND notes IS NOT NULL
  AND notes::jsonb ->> 'description' IS NOT NULL;
```

This sets `description` to `null` inside the JSON while preserving `requirements`. Rows updated by field reports (`source = 'field_report'`) are untouched.




## Clean Up Existing Records

There are **15 records** in `sector_needs_context` that have the generic event summary stored in their `notes.description` field. All contain the same blizzard summary text.

### Action

Run a single SQL UPDATE to null out the `description` field in the `notes` JSON for all affected records:

```sql
UPDATE sector_needs_context
SET notes = jsonb_set(notes::jsonb, '{description}', 'null'::jsonb)::text
WHERE notes::jsonb->>'description' IS NOT NULL;
```

This sets `description` to `null` inside the existing JSON object while preserving the `requirements` array and any other fields. No migration needed — this is a data-only change using the insert/update tool.

### Impact
- 15 rows updated
- Reasoning summaries for these needs will no longer display the generic event context
- The `requirements` array and other JSON fields remain untouched


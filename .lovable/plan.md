

# Clean Database -- Delete All Data

Remove all rows from every table in the correct order to respect foreign key constraints.

## Execution Order

Since several tables reference others, we need to delete child tables first:

1. **signals** (references events, sectors, field_reports)
2. **field_reports** (references events, sectors)
3. **deployments** (references events, sectors, capacity_types)
4. **sector_needs_context** (references events, sectors, capacity_types)
5. **sector_needs_sms** (references events, sectors, capacity_types)
6. **event_context_needs** (references events, capacity_types)
7. **sms_messages** (references events)
8. **initial_situation_reports** (references events)
9. **sectors** (references events)
10. **events**
11. **actor_capabilities** (references capacity_types)
12. **country_news_sources**
13. **capacity_types**
14. **profiles**
15. **user_roles**

## Technical Details

A single SQL statement using TRUNCATE with CASCADE will handle this cleanly:

```sql
TRUNCATE
  signals,
  field_reports,
  deployments,
  sector_needs_context,
  sector_needs_sms,
  event_context_needs,
  sms_messages,
  initial_situation_reports,
  sectors,
  events,
  actor_capabilities,
  country_news_sources,
  capacity_types,
  profiles,
  user_roles
CASCADE;
```

This removes all data from every table in one operation. No schema changes -- just data cleanup.

**Note:** This will also remove user profiles and roles. If you want to keep your own user account data, let me know and I will exclude `profiles` and `user_roles`.


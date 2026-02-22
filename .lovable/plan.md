

## Fix: Restore "Improving / Worsening" Trend Tags

### Root Cause

The trend tags ("Improving", "Worsening") rely on audit records stored in the `need_audits` table. Every time a need is evaluated, the system tries to insert an audit row containing the previous and new status. However, **all inserts are failing** because the code references a column (`llm_error`) that doesn't exist in the database.

With no audit records being saved, the system has no history to compare statuses, so it can never determine if a need is improving or worsening.

### Fix

Add the missing `llm_error` column to the `need_audits` table:

```sql
ALTER TABLE need_audits ADD COLUMN llm_error text;
```

### What This Restores

- Audit rows will be persisted on every need evaluation
- The trend derivation logic (which compares `previous_status` vs `final_status` from the latest audit) will have data to work with
- "Improving" and "Worsening" tags will reappear on the dashboard sector cards
- Full audit trail (reasoning, scores, guardrails) will be available for debugging

### Important Note

Existing evaluations that already ran will NOT retroactively get audit rows. Trend tags will start appearing after the **next** evaluation for each capability (e.g., after the next field report or deployment status change).


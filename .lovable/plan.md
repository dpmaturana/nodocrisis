

## Fix: Resolve NGO names via `actors` table instead of `profiles`

### Problem

The `profiles` table RLS only allows users to read **their own** profile. When the Sectors page tries to resolve other deployed actors' names, the query returns nothing, and the code falls back to showing the raw UUID.

### Solution

Replace the `profiles` lookup with an `actors` + `actor_members` lookup. Both tables have RLS policies that allow **all authenticated users** to SELECT — no database migration needed.

### Changes

**File: `src/services/sectorService.ts`** (lines 161-172)

Replace the profiles-based name resolution with:

1. Query `actor_members` to map `user_id` → `actor_id` for all deployed actor user IDs
2. Query `actors` to get `organization_name` for those actor IDs
3. Build the same `profileMap` (user_id → name) using the actors data

```ts
// Fetch actor names for deployed users via actor_members → actors
const deployedActorIds = [...new Set(deployments.map(d => d.actor_id))];
const profileMap = new Map<string, string>();
if (deployedActorIds.length > 0) {
  const { data: dbMembers } = await supabase
    .from("actor_members")
    .select("user_id, actor_id")
    .in("user_id", deployedActorIds);

  const actorIds = [...new Set((dbMembers ?? []).map(m => m.actor_id))];
  if (actorIds.length > 0) {
    const { data: dbActors } = await supabase
      .from("actors")
      .select("id, organization_name")
      .in("id", actorIds);

    const actorNameMap = new Map<string, string>();
    (dbActors ?? []).forEach(a => actorNameMap.set(a.id, a.organization_name));

    (dbMembers ?? []).forEach(m => {
      const name = actorNameMap.get(m.actor_id);
      if (name) profileMap.set(m.user_id, name);
    });
  }
}
```

No UI changes, no database migration. The pills will show the organization name from the `actors` table.


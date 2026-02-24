

## Root cause: Two different name resolution paths

The sector card pills (covering actors icon) use the **recently fixed** path: `actor_members` → `actors` → `organization_name`. This correctly shows "Bomberos sin Fronteras".

The activity log uses a **different, unfixed** path in `activityLogService.ts` (line 49-58): `fetchProfileMap` queries the `profiles` table directly. Due to RLS, non-admin users cannot read other users' profiles, so it falls back to `profile.organization_name` from their own profile entry — which shows "My NGO" (the value stored in the current user's profile, or whatever the profile row contains).

## Fix

**File: `src/services/activityLogService.ts`** — Replace `fetchProfileMap` to use the same `actor_members` → `actors` lookup pattern.

Replace the current `fetchProfileMap` function (lines 49-59) that queries `profiles` with:

```ts
async function fetchProfileMap(actorIds: string[]): Promise<Map<string, ProfileRow>> {
  if (actorIds.length === 0) return new Map();

  // Resolve names via actor_members → actors (avoids profiles RLS restriction)
  const { data: members, error: membersErr } = await supabase
    .from("actor_members")
    .select("user_id, actor_id")
    .in("user_id", actorIds);
  if (membersErr) console.error("activityLogService.fetchProfileMap (members):", membersErr);

  const actorOrgIds = [...new Set((members ?? []).map(m => m.actor_id))];
  const actorNameMap = new Map<string, string>();
  if (actorOrgIds.length > 0) {
    const { data: actors, error: actorsErr } = await supabase
      .from("actors")
      .select("id, organization_name")
      .in("id", actorOrgIds);
    if (actorsErr) console.error("activityLogService.fetchProfileMap (actors):", actorsErr);
    (actors ?? []).forEach(a => actorNameMap.set(a.id, a.organization_name));
  }

  return new Map<string, ProfileRow>(
    (members ?? []).map(m => [
      m.user_id,
      {
        user_id: m.user_id,
        organization_name: actorNameMap.get(m.actor_id) ?? null,
        full_name: null,
      } as ProfileRow,
    ]),
  );
}
```

No other changes needed. The rest of the activity log code (`mapDeploymentToEntry`) already reads `profile.organization_name` from the map, so it will pick up the correct actor name.


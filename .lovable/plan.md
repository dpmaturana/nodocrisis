

## Merged Fix: Profiles, Actor Capabilities, and Operating Actors Modal

### Step 1: Database Migration

Fix the signup trigger so new users get their name and organization saved, and backfill existing profiles:

```sql
-- Fix the signup trigger to save full_name and organization_name
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (user_id, email, full_name, organization_name)
    VALUES (
      NEW.id,
      NEW.email,
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'organization_name'
    );
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'actor');
    RETURN NEW;
END;
$$;

-- Backfill existing profiles from auth metadata
UPDATE profiles p
SET
  full_name = COALESCE(p.full_name, u.raw_user_meta_data->>'full_name'),
  organization_name = COALESCE(p.organization_name, u.raw_user_meta_data->>'organization_name')
FROM auth.users u
WHERE p.user_id = u.id
  AND (p.full_name IS NULL OR p.organization_name IS NULL);
```

### Step 2: Fix `actorNetworkService.ts`

Replace all references to `actor_capabilities_declared` with `actor_capabilities` (the table that actually exists). This affects approximately 7 occurrences across the file (lines 16, 23, 116, 190, 270, 286, 294).

This fixes the admin Actor Network detail view showing empty capabilities.

### Step 3: Fix `gapService.ts` -- `getOperatingActors()`

After fetching deployments and profiles, also fetch sectors to resolve UUIDs to names:

1. Collect unique `sector_id` values from the deployments
2. Query `sectors` table for `id, canonical_name`
3. Build a lookup map and use it when constructing the `sectors` array in each actor entry (replacing line 416)

This fixes the "Organizations operating" modal showing raw UUIDs instead of sector names.

---

### Summary

| Issue | File(s) | Fix |
|-------|---------|-----|
| Empty "My Organization" profile | Database trigger | Update `handle_new_user()` to read signup metadata + backfill |
| Admin can't see NGO capabilities | `actorNetworkService.ts` | Rename `actor_capabilities_declared` to `actor_capabilities` |
| Modal shows UUIDs for sectors | `gapService.ts` | Resolve sector IDs to `canonical_name` via lookup |
| Modal shows UUIDs for actors | Database trigger (same as row 1) | Once profiles have names, actor names display correctly |


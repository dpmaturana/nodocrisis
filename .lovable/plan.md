

# Connect Deployment Service to Real Database

## Problem
The `deploymentService.ts` is entirely mock-based. Enrollments write to an in-memory array that:
- Doesn't persist (lost on page refresh)
- Uses fake IDs that don't match real DB records
- Never touches the `deployments` database table

## Solution
Rewrite `deploymentService.ts` to use the real database via the existing client, while keeping the same public API so no consumer components need to change.

## Build Error Fix
Fix `src/lib/tweetSignalAggregation.ts` line 415: change `"Social/News"` to a valid `SourceReliability` value.

## Changes

### 1. Fix build error in `src/lib/tweetSignalAggregation.ts`
- Change the invalid `"Social/News"` literal to a valid `SourceReliability` type value (likely `"low"` or `"medium"` based on the enum definition).

### 2. Rewrite `src/services/deploymentService.ts`
Replace all mock data calls with real database queries:

**`getMyDeployments(actorId)`**
```
SELECT *, events(*), sectors(*), capacity_types(*)
FROM deployments
WHERE actor_id = actorId
```

**`getMyDeploymentsGrouped(actorId)`**
- Same query, then group results by `sector_id` in JS
- `determineSectorState`: query `sector_needs_context` for the sector instead of using `MOCK_SECTOR_CAPABILITY_MATRIX`
- `sectorContext`: use a simple default context (no mock lookup)
- `otherActors`: query `deployments` for the same sector where `actor_id != actorId`, joined with `profiles`

**`enroll(actorId, eventId, sectorId, capacityTypeId, notes)`**
```
INSERT INTO deployments (actor_id, event_id, sector_id, capacity_type_id, status, notes)
VALUES (...)
```
- Check for existing active deployment first via a SELECT

**`updateStatus(id, status)`** / **`updateStatusWithNote`** / **`markAsOperating`**
```
UPDATE deployments SET status = ?, updated_at = now() WHERE id = ?
```

**`markSectorAsOperating(sectorId, actorId)`**
```
UPDATE deployments
SET status = 'operating', updated_at = now()
WHERE sector_id = ? AND actor_id = ? AND status IN ('interested', 'confirmed')
```

**`getActiveCount()`** / **`getOperatingCount(eventId)`**
```
SELECT count(*) FROM deployments WHERE status = 'operating' [AND event_id = ?]
```

### 3. Remove mock imports
The rewritten service will no longer import from `./mock/data` for deployment-related functions (mock data files remain for other services that still use them).

## Technical Details

- All queries use `supabase` client from `@/integrations/supabase/client`
- RLS policies already exist on `deployments` table: users can manage their own, admins can manage all, and anyone authenticated can view
- The `determineSectorState` function will query `sector_needs_context` to check need levels instead of using a hardcoded matrix
- The `otherActors` field will query real deployments + profiles for the sector
- No database schema changes needed -- the `deployments` table already has all required columns

## Files Changed

| File | Change |
|---|---|
| `src/lib/tweetSignalAggregation.ts` | Fix `"Social/News"` type error |
| `src/services/deploymentService.ts` | Replace all mock calls with real DB queries |


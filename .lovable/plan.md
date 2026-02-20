

# Fix: Include "interested" Deployments in Coverage Queries

## Problem

The last merge correctly added deployment coverage logic to `gapService.ts`, but the database queries filter by `status IN ('confirmed', 'operating')` only. When an NGO subscribes, the deployment is created with status `interested`, which gets excluded from the count. The colors never change.

## Fix

Two lines need to change in `src/services/gapService.ts`:

### Line 210 (in `getGapsGroupedBySector`)

Change:
```typescript
.in("status", ["confirmed", "operating"]);
```
To:
```typescript
.in("status", ["confirmed", "operating", "interested"]);
```

### Line 421 (in `getCounts`)

Same change:
```typescript
.in("status", ["confirmed", "operating"]);
```
To:
```typescript
.in("status", ["confirmed", "operating", "interested"]);
```

## Expected Result

- After subscribing as an NGO, "Emergency medical care" in Tagus River Basin and Levante Coast should change from RED to ORANGE (1 deployment against demand of 2 for "high" level)
- Dashboard metric cards update accordingly (fewer critical, more partial)

## Files Changed

| File | Change |
|---|---|
| `src/services/gapService.ts` | Add `"interested"` to deployment status filters on lines 210 and 421 |


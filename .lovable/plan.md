

# Filter Sector Card Gaps by Active Capability Filter

## Problem
When a capability filter is selected, the sector list correctly hides sectors that don't have that capability. However, for sectors that DO match, the card still shows ALL capabilities instead of only the filtered one.

## Fix

### File: `src/components/dashboard/SectorGapList.tsx`

When passing gaps to `SectorStatusChip`, filter them by `activeCapacityFilters` if any are active:

At line 156, change:
```
gaps={sectorData.gaps}
```
to:
```
gaps={activeCapacityFilters.length > 0
  ? sectorData.gaps.filter(g => activeCapacityFilters.includes(g.capacity_type_id))
  : sectorData.gaps}
```

This ensures that when a capability filter is active, each sector card only displays the matching capability rows while keeping the full list when no filter is applied.




## Show trend badges only on the 2 most recently updated needs across the entire dashboard

### Problem
Currently, every gap that has a trend shows its trend badge. You want only the 2 most recently updated needs (across ALL sectors on the dashboard) to display their trend tag.

### How it works

**1. `src/components/dashboard/SectorGapList.tsx`**

After fetching all sectors with gaps, compute the IDs of the 2 most recently updated gaps dashboard-wide:
- Flatten all gaps from all sectors
- Sort by `last_updated_at` descending
- Take the first 2 gap IDs into a `Set`
- Pass this set down to each `SectorStatusChip` as a new prop `trendVisibleGapIds`

**2. `src/components/dashboard/SectorStatusChip.tsx`**

- Accept a new prop `trendVisibleGapIds: Set<string>`
- Pass a `showTrend` boolean to each `DriverRow`: `true` only if the gap's ID is in the set
- `DriverRow` receives `showTrend` prop; only renders the trend badge when `showTrend` is true
- Translate `TREND_CONFIG` labels to English:
  - "Mejorando" -> "Improving"
  - "Empeorando" -> "Worsening"
  - "Estable" -> "Stable"
- Translate other Spanish strings: "Necesidades" -> "Needs", "Capacidad" -> "Capability", "Actualizar estado" -> "Update status", "Ver detalles" -> "View details"

### Technical details

```text
SectorGapList
  |-- computes: trendVisibleGapIds = Set of 2 gap IDs with latest last_updated_at
  |
  +-- SectorStatusChip (receives trendVisibleGapIds)
        |
        +-- DriverRow (receives showTrend = trendVisibleGapIds.has(gap.id))
              |-- renders trend badge only if showTrend === true
```

- All gaps remain visible in every card -- no truncation
- Only the trend tag visibility changes
- The 2 gaps are selected globally across all sectors based on `last_updated_at`

### Files changed

1. `src/components/dashboard/SectorGapList.tsx` -- compute top-2 recently updated gap IDs, pass as prop
2. `src/components/dashboard/SectorStatusChip.tsx` -- accept `trendVisibleGapIds` prop, conditionally show trend, translate labels to English

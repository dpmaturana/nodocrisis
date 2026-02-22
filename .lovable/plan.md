

## Add Requirement Pills, Reasoning Summary, and Deployed NGOs to Actor Sector Cards

### What changes

The actor-facing sector cards and detail drawer will be enriched to show the same information that admins see:
1. **Requirement pills** (e.g., "Ambulances", "water") per gap -- the small tags from the `notes` JSON field
2. **Reasoning summary** per gap -- the description text explaining why that need exists
3. **Deployed NGOs** per gap -- which organizations are already covering each need and their status

### Changes

**1. `src/services/sectorService.ts` -- Fetch notes, audits, and actor profiles**

In `getEnrichedSectors()`:
- Fetch the `notes` field from `sector_needs_context` (already queried but not used)
- Parse `notes` JSON to extract `requirements` array and `description` string (same logic as `gapService.ts` lines 212-235)
- Fetch `need_audits` for reasoning summaries (latest per sector+capability pair)
- Fetch `profiles` for deployed actor IDs to resolve names (currently uses raw UUIDs)
- Add `operational_requirements`, `reasoning_summary`, and `coveringActors` to each `SectorGap`

**2. `src/types/database.ts` -- Add optional fields to `SectorGap`**

- Add `operational_requirements?: string[]` to `SectorGap` interface
- Add `reasoning_summary?: string` to `SectorGap` interface
- (`coveringActors` already exists on the type)

**3. `src/components/sectors/SectorCard.tsx` -- Display pills and summary**

For each gap in the "Capabilities you can provide" section:
- Show requirement pills as small rounded tags (e.g., "Ambulances", "Medical kits") below the gap name
- Show reasoning summary as a small muted text underneath
- Show covering actors with status icons inline

**4. `src/components/sectors/SectorDetailDrawer.tsx` -- Display pills and summary in detail view**

For each gap in the "Active Gaps" section:
- Add requirement pills below each gap's header row
- Show reasoning summary text
- Already shows `coveringActors` -- just needs data to be populated

### Technical Details

**SectorGap type update** (`src/types/database.ts`):
```text
export interface SectorGap {
  // ... existing fields ...
  coveringActors?: Array<{ name: string; status: string }>;
  operational_requirements?: string[];   // NEW
  reasoning_summary?: string;            // NEW
}
```

**sectorService.ts enrichment** -- In the `getEnrichedSectors` loop, for each need:
- Parse `notes` JSON using the same pattern from `gapService.ts` (lines 212-235)
- Fetch latest `need_audits` row per (sector_id, capability_id) for `reasoning_summary` fallback
- Resolve actor names via profiles table join on deployments
- Pass `operational_requirements`, `reasoning_summary`, and `coveringActors` into each `SectorGap`

**SectorCard.tsx** -- Inside each gap card, add:
- `flex-wrap gap-1` container with requirement pills as `<span>` tags with `rounded-full border text-xs` styling
- `<p>` with `text-xs text-muted-foreground italic` for reasoning summary
- This mirrors the expandable `DriverRow` pattern from the admin side but shown inline (since actors have fewer gaps displayed)


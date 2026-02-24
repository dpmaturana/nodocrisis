

## Two Issues to Fix

### Issue 1: Hide "Key Context" section from the NGO Sector Cards

The `SectorCard.tsx` component (lines 61-72) always renders a "Key Context" section with bullet points. This should be hidden for NGO/actor users since they don't need this administrative context.

**Change**: In `SectorCard.tsx`, remove the "Key Context" section entirely (lines 60-72). The NGO card should focus on actionable information: status badge, best-match gaps, and CTAs.

### Issue 2: Stop filling `reasoning_summary` with event creation context

**Root cause**: In `supabase/functions/materialize-event-needs/index.ts` (line 115), the system stores the event's general situation report summary (`report?.summary`) as the `description` field in every need's `notes` JSON. This generic event text (e.g., "A major snowstorm, potentially the first blizzard since 2022...") then gets picked up as `reasoning_summary` through the fallback chain in `sectorService.ts`, `gapService.ts`, and `deploymentService.ts`.

**Change**: In `materialize-event-needs/index.ts` line 115, set `description` to `null` instead of `report?.summary`. The reasoning summary should only be populated by actual need evaluation (from `need_audits`), not from the generic event creation context.

### Files Modified
1. `src/components/sectors/SectorCard.tsx` — Remove lines 60-72 (Key Context section)
2. `supabase/functions/materialize-event-needs/index.ts` — Line 115: change `description: report?.summary ?? null` to `description: null`

### Impact
- Existing needs that already have the event summary stored will still display it. To clean those up, we could also add a note about running a one-time SQL update, but the primary fix prevents new needs from getting the wrong text.
- The `reasoning_summary` field will only show meaningful per-capability reasoning from the evaluation engine going forward.


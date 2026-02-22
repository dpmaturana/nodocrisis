

## Enhance My Deployments Layout

### Changes

**1. Group cards by event with event name header (`MyDeployments.tsx`)**
- Group `activeGroups` by `event.id` into a map
- Render an `<h2>` with the event name before each group of sector cards
- Same for `historyGroups`

**2. Hide event name from each card (`SectorDeploymentCard.tsx`)**
- Remove lines 181-190 (the `Activity` icon + event name + location row) since event name is now in the group header

**3. Move sector state badge next to sector name (`SectorDeploymentCard.tsx`)**
- Move the `StatusBadge` from the separate "Phase/State indicator" div (lines 195-203) to be inline with the sector name on line 179
- Remove the now-empty separate div

**4. Show need status on each CapabilityRow (`CapabilityRow.tsx`)**
- Import `NEED_STATUS_PRESENTATION` and `NeedStatus` from `@/lib/needStatus`
- If `deployment.need_status` exists, render a small colored dot + label next to the deployment status badge

**5. Hide `(high)` etc. from requirement pills (`CapabilityRow.tsx`)**
- Strip parenthesized level text like `(high)`, `(critical)`, `(medium)`, `(low)` from each requirement string using regex before display

### Technical Details

**`MyDeployments.tsx`**: Group active/history groups by `event.id`:
```text
const groupedByEvent = Map<string, { eventName: string; groups: SectorDeploymentGroup[] }>
```
Render `<h2 className="text-xl font-semibold">{eventName}</h2>` before each event's cards.

**`SectorDeploymentCard.tsx`**: Header becomes:
```text
[MapPin] [Sector Name] [StatusBadge]
```
No more event name row, no more separate phase/state div.

**`CapabilityRow.tsx`**: Between capability name and deployment badge, show need status dot. Strip `(high)` etc. with `req.replace(/\s*\((?:high|critical|medium|low)\)\s*$/i, "").trim()`.


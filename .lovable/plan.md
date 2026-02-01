
# Plan: Fix MapView Issues

## Issues to Address

| Issue | Description | Root Cause |
|-------|-------------|------------|
| 1. Tooltip overflow | Capability names bleed outside tooltip container | Leaflet tooltips need explicit text wrapping CSS |
| 2. Sticky position lost | Top of map gets cut off when scrolling | Map uses `top-0` but ActorHeader is sticky at `top-0 h-14` |
| 3. Map too small | User wants taller map | Current height is `30vh` |
| 4. Previous card visible | After clicking pin, bottom of previous card shows above target card | Scroll offset doesn't account for extra spacing to clear previous card |

---

## Implementation Details

### 1. Fix Tooltip Text Overflow

**File: `src/components/map/SectorTooltip.tsx`**

Update container classes to ensure text wraps properly:
- Increase `max-w-[280px]` to `max-w-[300px]`
- Add `break-words` class for long capability names

**File: `src/index.css`**

Add Leaflet tooltip override at the end to force proper text wrapping:
```css
/* Leaflet tooltip overrides */
.leaflet-tooltip {
  max-width: 300px !important;
  white-space: normal !important;
  word-wrap: break-word !important;
}
```

---

### 2. Fix Sticky Position (Map Cut Off)

**File: `src/components/map/MapView.tsx`**

The ActorHeader is sticky with height `h-14` (56px). The map needs to stick below it:

Change from:
```tsx
<div className="sticky top-0 z-10 ...">
```

To:
```tsx
<div className="sticky top-14 z-10 ...">
```

This ensures the map sticks at 56px from the top, directly below the header.

---

### 3. Increase Map Height

**File: `src/components/map/MapView.tsx`**

Change map dimensions from `h-[30vh]` to `h-[40vh]`:

| Property | Before | After |
|----------|--------|-------|
| Height | `h-[30vh]` | `h-[40vh]` |
| Min height | `min-h-[200px]` | `min-h-[250px]` |
| Max height | `max-h-[35vh]` | `max-h-[45vh]` |

Apply to both the empty state container (line 74) and the main map container (line 81).

---

### 4. Fix Scroll Position (Hide Previous Card)

**File: `src/hooks/useSectorFocus.ts`**

The current scroll calculation:
```typescript
const headerOffset = 48;
const mapHeight = window.innerHeight * (mapHeightVh / 100);
const padding = 16;
```

The issue is that `padding = 16` is not enough to push the previous card completely out of view. We need to add more spacing.

Updated calculation:
```typescript
const headerOffset = 56;  // ActorHeader height (h-14 = 56px)
const mapHeight = window.innerHeight * (mapHeightVh / 100);
const extraClearance = 24; // Extra space to fully hide previous card
```

The new formula ensures the target card's top edge sits with enough clearance below the sticky map that no part of the previous card is visible.

Also update the default parameter from `30` to `40` to match the new map height.

**File: `src/pages/Sectors.tsx`**

Update the `useSectorFocus` call to use the new height:
```typescript
const { focusedSectorId, highlightedCardId, setFocusedSectorId, scrollToCard } = useSectorFocus(40);
```

---

## Summary of Changes

| File | Changes |
|------|---------|
| `src/components/map/SectorTooltip.tsx` | Increase max-width to 300px, add `break-words` |
| `src/components/map/MapView.tsx` | Change `top-0` → `top-14`, increase height to `40vh` |
| `src/hooks/useSectorFocus.ts` | Update default to 40vh, fix headerOffset to 56px, add extra clearance (24px) |
| `src/pages/Sectors.tsx` | Update `useSectorFocus(40)` call |
| `src/index.css` | Add Leaflet tooltip CSS overrides |

## Estimated Credits
2 credits

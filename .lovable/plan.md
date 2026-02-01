

# Plan: Add Fixed Spacing Below Sticky Map

## Problem

When the map becomes sticky (fixed at the top), the visual gap between the map and the first card disappears. This creates a jarring UX where content feels cramped against the map edge.

## Solution

Add a bottom margin to the MapView component that matches the `space-y-6` (24px / 1.5rem) gap used throughout the page. This ensures consistent spacing whether the map is in its normal position or sticky.

## Implementation

### File: `src/components/map/MapView.tsx`

Add `mb-6` (margin-bottom: 1.5rem = 24px) to the map container div. This matches the `space-y-6` spacing used in the Sectors page.

**Changes to line 74 (empty state):**
```tsx
// Before
<div className="sticky top-14 z-10 h-[40vh] min-h-[250px] max-h-[45vh] rounded-lg overflow-hidden border border-border bg-muted flex items-center justify-center">

// After
<div className="sticky top-14 z-10 h-[40vh] min-h-[250px] max-h-[45vh] mb-6 rounded-lg overflow-hidden border border-border bg-muted flex items-center justify-center">
```

**Changes to line 81 (main map container):**
```tsx
// Before
<div className="sticky top-14 z-10 h-[40vh] min-h-[250px] max-h-[45vh] rounded-lg overflow-hidden border border-border shadow-lg">

// After  
<div className="sticky top-14 z-10 h-[40vh] min-h-[250px] max-h-[45vh] mb-6 rounded-lg overflow-hidden border border-border shadow-lg">
```

## Result

The map will maintain a consistent 24px gap below it at all times, matching the spacing between cards and other page elements. This creates a visually clean separation even when the map is in sticky mode.

## Estimated Effort
Less than 1 credit


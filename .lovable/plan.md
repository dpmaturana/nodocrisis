
# Fix: Capacity Filter Not Working

## Root Cause

The `DropdownMenuTrigger` uses `asChild` with a `Badge` component as its child. The `Badge` component is a plain function component (not wrapped in `React.forwardRef`) and renders a `<div>`. Radix UI's `asChild` pattern requires the child to forward refs, but since `Badge` doesn't, the dropdown trigger loses its ref connection. This causes the dropdown menu interaction to break -- checkbox items don't properly trigger `onCheckedChange`.

## Fix

Replace the `Badge` inside `DropdownMenuTrigger asChild` with a native `<button>` element that can naturally receive refs. This avoids modifying the shared `Badge` component and ensures proper Radix behavior.

## Technical Details

### File: `src/components/dashboard/FilterChips.tsx`

Replace lines 110-121 (the `DropdownMenuTrigger` section):

**Before:**
```tsx
<DropdownMenuTrigger asChild>
  <Badge
    variant="outline"
    className={cn(
      "px-3 py-1.5 text-sm font-medium cursor-pointer transition-all",
      activeCapacityFilters.length > 0 && "border-primary text-primary",
    )}
  >
    Capacidad
    {activeCapacityFilters.length > 0 && ` (${activeCapacityFilters.length})`}
    <ChevronDown className="w-3 h-3 ml-1" />
  </Badge>
</DropdownMenuTrigger>
```

**After:**
```tsx
<DropdownMenuTrigger asChild>
  <button
    className={cn(
      "inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium cursor-pointer transition-all",
      activeCapacityFilters.length > 0
        ? "border-primary text-primary"
        : "text-foreground hover:border-primary hover:text-primary",
    )}
  >
    Capacidad
    {activeCapacityFilters.length > 0 && ` (${activeCapacityFilters.length})`}
    <ChevronDown className="w-3 h-3 ml-1" />
  </button>
</DropdownMenuTrigger>
```

This is a one-line-scope change in a single file. The `<button>` natively supports refs and all Radix trigger behaviors, fixing the filter.

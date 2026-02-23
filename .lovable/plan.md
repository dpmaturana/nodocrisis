

# Fix Capability Filter and Operating Actors Count

## Bug 1: Capability Filter Dropdown Doesn't Open

**Root cause**: The `Badge` component is a plain `<div>` without `React.forwardRef`. When used as a child of `DropdownMenuTrigger asChild`, Radix UI's `Slot` component needs the child to forward refs. Without it, the dropdown trigger silently fails and never opens.

**Fix**: In `FilterChips.tsx`, replace the `Badge` inside `DropdownMenuTrigger asChild` with a `<button>` element styled with `badgeVariants`, which natively supports refs. This avoids modifying the shared Badge component.

### File: `src/components/dashboard/FilterChips.tsx`

- Replace the `<Badge>` inside `<DropdownMenuTrigger asChild>` with a `<button>` that uses the same badge styling classes
- Import `badgeVariants` from the badge component for consistent styling

---

## Bug 2: Operating Actors Count Shows Deployment Rows Instead of Unique Actors

**Root cause**: In `gapService.getDashboardMeta()`, the query uses `{ count: "exact", head: true }` on the `deployments` table filtered by status. This counts total deployment **rows**, not unique actors. One actor with 6 deployments across sectors shows as "6 organizations operating."

**Fix**: Change the counting approach to count distinct actor IDs.

### File: `src/services/gapService.ts`

In `getDashboardMeta()` (around line 346-349):

- Instead of counting rows with `head: true`, fetch the `actor_id` column and count unique values:
  - Query: `select("actor_id").eq("event_id", eventId).in("status", ["operating", "confirmed"])`
  - Then: `new Set(data.map(d => d.actor_id)).size`

This ensures the count matches the number of unique organizations shown in the modal.


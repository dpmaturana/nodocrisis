

## Add "Back to Deployments" Navigation in Actor Header

### Problem
When an actor navigates to `/my-capabilities`, there's no visible way to return to `/my-deployments` or `/sectors`. The header only contains the logo and a dropdown menu.

### Solution
Add a "My Deployments" link to the ActorHeader dropdown menu, so the actor can always navigate between their key pages.

### Changes

**`src/components/layout/ActorHeader.tsx`**
- Add a new `DropdownMenuItem` for "My Deployments" (with a `MapPin` icon) above the existing "My Capabilities" item
- This gives actors a consistent way to navigate between their two main pages from anywhere

The dropdown will show:
1. My Deployments
2. My Capabilities
3. --- (separator)
4. Sign out

### Technical Details
- Import `MapPin` from lucide-react (already used elsewhere in the project)
- Add `DropdownMenuItem` with `onClick={() => navigate("/my-deployments")}`
- No routing or layout changes needed since `/my-deployments` is already a valid actor route

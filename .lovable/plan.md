

## Collapsible reasoning pill in DriverRow

Make the `reasoning_summary` text (the italic description below each capability name) hidden by default and expandable with a small chevron arrow toggle.

### How it works

In the `DriverRow` component inside `SectorStatusChip.tsx`:

1. Add a `useState` boolean (`expanded`, default `false`) to track open/closed state
2. Add a small `ChevronRight` icon button next to the capability name that rotates to `ChevronDown` when expanded
3. Wrap the `reasoning_summary` paragraph and `requirements` pills in a conditionally rendered block gated by `expanded`
4. The chevron only appears when there is a `reasoning_summary` or requirements to show

### Visual behavior

- **Collapsed (default):** Only the capability name row is visible (icon + name + trend + actor count + small chevron arrow)
- **Expanded (after click):** The reasoning text and requirement pills slide into view below

### Technical details

**File:** `src/components/dashboard/SectorStatusChip.tsx`

- Import `ChevronRight` from `lucide-react` and `useState` from React
- Add `const [expanded, setExpanded] = useState(false)` inside `DriverRow`
- Add a chevron toggle button in the header row (only when content exists):
  ```
  <button onClick={() => setExpanded(!expanded)}>
    <ChevronRight className={cn("w-3 h-3 transition-transform", expanded && "rotate-90")} />
  </button>
  ```
- Gate both the `reasoning_summary` and `requirements` blocks with `{expanded && (...)}`

No other files need changes.


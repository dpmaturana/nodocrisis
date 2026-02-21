

## Show requirement pills + reasoning summary in expanded need rows

### Change

Update the `DriverRow` expanded section in `src/components/dashboard/SectorStatusChip.tsx` to show:

1. **Line 1**: Operational requirement names as simple pills (just the name, no severity like "critical" or "high")
2. **Line 2**: The `reasoning_summary` as a descriptive sentence below

### Technical details

**File: `src/components/dashboard/SectorStatusChip.tsx`**

In the `DriverRow` component:

- Keep `requirements` and add `summary`:
  ```typescript
  const requirements = gap.operational_requirements ?? [];
  const summary = gap.reasoning_summary;
  const hasExpandableContent = requirements.length > 0 || !!summary;
  ```

- Strip severity suffixes from requirement labels. Currently they come as e.g. `"water (high)"` -- extract just the name portion before any parenthetical:
  ```typescript
  const cleanLabel = (req: string) => req.replace(/\s*\(.*?\)\s*$/, "");
  ```

- Update the expanded content block (lines ~72-83) to render both:
  ```tsx
  {expanded && hasExpandableContent && (
    <div className="ml-4 space-y-1.5 pb-1.5">
      {requirements.length > 0 && (
        <div className="flex flex-wrap gap-1 px-2">
          {requirements.map((req, i) => (
            <span key={i} className="text-xs px-1.5 py-0.5 rounded-full border font-medium text-muted-foreground">
              {cleanLabel(req)}
            </span>
          ))}
        </div>
      )}
      {summary && (
        <p className="px-2 text-xs text-muted-foreground">{summary}</p>
      )}
    </div>
  )}
  ```

### Files changed

1. `src/components/dashboard/SectorStatusChip.tsx` -- update expanded content to show clean requirement pills + reasoning summary


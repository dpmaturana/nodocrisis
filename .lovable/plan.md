

## Group related signals and status changes in the Activity Log

### Problem
Signals and the status changes they trigger appear as separate, disconnected cards in the activity log, even though they happen at the same moment and are causally related.

### Solution
Group entries that occur within a short time window (60 seconds) into a single visual block, with the STATUS_CHANGE as the "parent" and its triggering signals nested underneath.

### How it works

**File: `src/components/dashboard/ActivityLogModal.tsx`**

1. After fetching and sorting entries, run a grouping pass:
   - Walk the sorted entries list
   - When a `STATUS_CHANGE` entry is found, look at the entries immediately after it (next in chronological order = older)
   - If a `SIGNAL_RECEIVED` or `COVERAGE_ACTIVITY_EVENT` entry has a timestamp within 60 seconds of the status change, attach it as a "child"
   - Continue until the time gap exceeds 60s or another STATUS_CHANGE is found
   - Entries that don't belong to any group render standalone as before

2. Render grouped entries as a single card:
   - The STATUS_CHANGE renders at the top (transition dots, reasoning, etc.) -- same as today
   - Below it, a subtle "Triggered by" label with the related signal(s) rendered inline as compact sub-items (indented, smaller, with their source badge)
   - A left border or connector line visually ties them together

3. Standalone signals (not near a status change) render exactly as they do today -- no change.

### Visual result

```text
+-----------------------------------------------+
| Status change         (System badge)           |
| Decision engine: [red dot] -> [yellow dot]     |
| [sparkle] Human-readable reasoning...          |
|                                                |
|   Triggered by:                                |
|   | [radio] Signal received  (ONG badge)       |
|   | ONG: People are reported to be trapped...  |
|                                                |
| 16 minutes ago                                 |
+-----------------------------------------------+
```

### Technical details

- Grouping logic: iterate sorted entries (newest first). For each STATUS_CHANGE, collect subsequent entries within 60s as children. Mark consumed entries so they don't render again standalone.
- Type: define a `GroupedLogEntry = { main: CapabilityActivityLogEntry; related: CapabilityActivityLogEntry[] }` local type.
- The grouping runs purely in the component after data fetch -- no backend or service changes needed.
- Only the `ActivityLogModal.tsx` file changes.

### Files changed

1. `src/components/dashboard/ActivityLogModal.tsx` -- add grouping logic and nested rendering for related entries

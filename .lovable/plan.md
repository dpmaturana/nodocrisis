

## Why the color is still not changing

Two things were never fixed in the last merge:

### Issue 1: Signal engine is never called
In `supabase/functions/extract-text-report/index.ts` (line 255), the code checks for an environment variable `PROCESS_FIELD_REPORT_SIGNALS_URL`. This variable is **not set**, so the engine that would escalate the need level from `high` to `critical` is skipped every time. The edge function logs confirm this:
> `"PROCESS_FIELD_REPORT_SIGNALS_URL not set; skipping engine invocation"`

### Issue 2: `adjustStatusForCoverage` ignores demand thresholds
In `src/services/gapService.ts` (lines 113-116), both `critical` and `high` levels are downgraded to ORANGE whenever there's even 1 deployment. There's no threshold check (critical should need 3, high should need 2).

### Fix 1: Replace env var with direct URL construction
In both `extract-text-report/index.ts` and `transcribe-field-report/index.ts`, replace:
```
const processSignalsUrl = Deno.env.get("PROCESS_FIELD_REPORT_SIGNALS_URL");
```
with:
```
const processSignalsUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/process-field-report-signals`;
```
`SUPABASE_URL` is always available in edge functions, so the engine will always be called.

### Fix 2: Add demand thresholds to `adjustStatusForCoverage`
Update the function in `src/services/gapService.ts` so that:
- `critical` stays RED unless there are 3+ deployments
- `high` stays RED unless there are 2+ deployments  
- `medium` moves to YELLOW with 1+ deployment (current behavior, unchanged)

```typescript
export function adjustStatusForCoverage(
  level: string,
  activeDeploymentCount: number,
): { state: GapState; needStatus: NeedStatus } {
  const baseState = mapNeedLevelToGapState(level);
  const baseStatus = mapGapStateToNeedStatus(baseState);

  if (activeDeploymentCount <= 0) {
    return { state: baseState, needStatus: baseStatus };
  }

  const demandThreshold: Record<string, number> = {
    critical: 3,
    high: 2,
    medium: 1,
  };
  const threshold = demandThreshold[level] ?? 0;

  if (activeDeploymentCount >= threshold && threshold > 0) {
    switch (level) {
      case "critical":
      case "high":
        return { state: "partial", needStatus: "ORANGE" };
      case "medium":
        return { state: "partial", needStatus: "YELLOW" };
    }
  }

  return { state: baseState, needStatus: baseStatus };
}
```

### Fix 3: Update the unit test
Update `src/test/adjustStatusForCoverage.test.ts` to expect the new threshold behavior (e.g., critical with 1 deployment stays RED, critical with 3 moves to ORANGE).

### Fix 4: Re-trigger signal processing for Bordeaux
Call `process-field-report-signals` for the existing Bordeaux field report so it escalates the need level from `high` to `critical`. After that, with the threshold fix, Bordeaux's "Emergency medical care" (1 deployment, threshold 3) will correctly show RED.


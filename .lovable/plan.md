

## Fix: Deploy the evaluate-need Edge Function + Add Transition Clamping

### Root Cause

The `evaluate-need` edge function was **never deployed**. It exists in code but:
- Is missing from `supabase/config.toml`
- Returns HTTP 404 when called (confirmed by live test)
- Every frontend call to this function silently fails

For `process-field-report-signals` (which calls `evaluateNeedStatusWithLLM` directly), the LLM call may also fail silently, but at least that function is deployed.

### Changes

#### 1. Add `evaluate-need` to `supabase/config.toml`

Add the missing entry so the function gets deployed:

```toml
[functions.evaluate-need]
verify_jwt = false
```

#### 2. Deploy the `evaluate-need` edge function

Trigger deployment so the function becomes available at the expected endpoint.

#### 3. Transition clamping is already implemented

Looking at the current code (lines 296-304 of `evaluateNeedStatusWithLLM.ts`), the rule-based fallback path already has transition clamping:

```
if (!legalTransition && previousStatus !== undefined) {
  proposal = prevStatus;
  guardrailsApplied.push("transition_clamping");
}
```

And the LLM path (lines 279-283) also blocks illegal transitions. So the RED-to-WHITE bug should already be fixed in the current code -- it just was never deployed.

#### 4. Test the deployed function

After deployment, send a test request to verify:
- The function responds (no more 404)
- The LLM is called successfully (check for `llm_used: true` in response)
- Transition clamping works (send a stabilization signal with `previousStatus: "RED"` and verify it stays RED)

### Expected Outcome

Once deployed, the `evaluate-need` function will be live, the frontend will get real LLM-based evaluations, and illegal transitions like RED-to-WHITE will be blocked by the existing clamping logic.


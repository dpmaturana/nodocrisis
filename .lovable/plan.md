

## Problem

The per-capability extraction was only applied to `extract-text-report` (text-only reports). The test report was submitted via **audio recording**, which goes through `transcribe-field-report` — and that function still uses the **old flat extraction prompt**. It produces a single `observations` string and flat `items[]` shared across all capabilities, so `process-field-report-signals` falls back to the legacy path.

## Fix

Update `supabase/functions/transcribe-field-report/index.ts` to use the same per-capability extraction prompt and normalization logic already working in `extract-text-report`.

### Changes to `transcribe-field-report/index.ts`

1. **Replace the extraction prompt** (lines 9-28) with the per-capability version that asks the LLM to group items, observations, and evidence by capability — identical to what `extract-text-report` now uses.

2. **Update the `ExtractedData` interface** (lines 30-44) to include the `capabilities` array and `CapabilityExtraction` type.

3. **Update the JSON parsing block** (lines 249-257) to normalize the LLM response into the new format with backward-compatible flat fields derived from the `capabilities` array (same logic as `extract-text-report` lines 211-252).

4. **Update signal creation** (lines 272-350) to use per-capability signals when the `capabilities` array is present:
   - Each capability gets its own signal with its specific `observation` as `content`
   - Falls back to the existing flat signal creation when `capabilities` is absent

5. **Pass the full `extractedData` (with `capabilities`)** to `process-field-report-signals` (line 324) — this already happens, but now the data will contain the `capabilities` array so the processor will use the per-capability path instead of falling back to legacy.

### No other files need changes

- `process-field-report-signals/index.ts` already has the per-capability processing path — it just never receives the data because the audio pipeline wasn't producing it.
- `extract-text-report/index.ts` is already correct.

### Expected Result

After this fix, an audio report saying "Debris has been successfully removed. Temporary tents are now needed for shelter" will produce:

- **Debris removal**: `sentiment: "improving"`, stabilization signals, status improves
- **Shelter / housing**: `sentiment: "worsening"`, demand/insufficiency signals, status worsens or stays RED

### Technical Details

The extraction prompt and normalization code will be duplicated between the two edge functions. This is intentional — edge functions cannot share non-`_shared` code easily, and the prompt needs to stay co-located with its parsing logic. The `_shared` folder is reserved for the evaluation engine.



# Fix Field Report Signals: English Output + Real Capability Linking

## Problem

1. **Spanish output**: The LLM extraction prompts are entirely in Spanish, producing Spanish signal content (e.g., "Se reporta la perdida de viviendas...") instead of English
2. **No capability linking**: The `capacity_type_id` column was accidentally removed from the `signals` table, breaking the link between signals and capabilities
3. **Hardcoded labels**: Both edge functions use hardcoded Spanish capability names ("salud", "agua") instead of the real 17 English names from `capacity_types`

## Solution

### 1. Restore `capacity_type_id` column on `signals` table

Add a migration to re-create the column with a foreign key to `capacity_types`:

```sql
ALTER TABLE signals ADD COLUMN capacity_type_id uuid REFERENCES capacity_types(id);
```

### 2. Update `extract-text-report/index.ts`

- Rewrite `EXTRACTION_PROMPT` in English
- The function already fetches `capacity_types` and injects them into the prompt -- keep that pattern but ensure the prompt instructs the LLM to output English observations and use exact English capability names
- The function already creates per-capability signals with `capacity_type_id` -- this will work once the column is restored and the LLM outputs correct names

### 3. Update `transcribe-field-report/index.ts`

- Same prompt rewrite to English
- Already fetches `capacity_types` dynamically and creates per-capability signals
- Ensure prompt instructs: output English observations, use exact capability names from the provided list

### Key Prompt Changes

**Before** (Spanish, hardcoded):
```
capability_types: [...] Valores validos: "agua", "alimentos", ...
observations: Resumen publico de 1-2 oraciones...
```

**After** (English, dynamic):
```
capability_types: Use EXACTLY these names: "Emergency medical care", "Search and rescue", "Shelter", ...
observations: A 1-2 sentence public summary in English...
```

### Files to Change

| File | Change |
|---|---|
| Migration (new) | Re-add `capacity_type_id` column to `signals` |
| `supabase/functions/extract-text-report/index.ts` | Rewrite prompt to English, ensure correct capability name matching |
| `supabase/functions/transcribe-field-report/index.ts` | Same prompt rewrite to English |

### Result

- Signal content will be in English (matching the internationalization standard)
- Each signal will be linked to its `capacity_type_id`, enabling gap engine integration
- The LLM will output real capability names like "Emergency medical care" instead of "salud"


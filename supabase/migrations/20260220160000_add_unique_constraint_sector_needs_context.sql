-- Add unique constraint on (event_id, sector_id, capacity_type_id)
-- so the upsert in extract-text-report and transcribe-field-report works correctly.
ALTER TABLE public.sector_needs_context
  ADD CONSTRAINT sector_needs_context_event_sector_cap_unique
  UNIQUE (event_id, sector_id, capacity_type_id);

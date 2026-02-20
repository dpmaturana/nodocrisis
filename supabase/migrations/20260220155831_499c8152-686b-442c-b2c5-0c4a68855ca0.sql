ALTER TABLE public.sector_needs_context
  ADD CONSTRAINT sector_needs_context_event_sector_cap_uq
  UNIQUE (event_id, sector_id, capacity_type_id);
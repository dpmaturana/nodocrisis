-- Add capacity_type_id column to signals table
-- This allows field report signals to be linked to specific capacity types,
-- enabling the gap calculation engine to attribute signals to the right capability.

ALTER TABLE public.signals
  ADD COLUMN capacity_type_id UUID REFERENCES public.capacity_types(id) ON DELETE SET NULL;

CREATE INDEX idx_signals_capacity_type_id ON public.signals(capacity_type_id);

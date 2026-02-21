
-- Create need_audits table for engine decision tracking
CREATE TABLE public.need_audits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sector_id UUID NOT NULL REFERENCES public.sectors(id),
  capability_id UUID NOT NULL REFERENCES public.capacity_types(id),
  event_id UUID NOT NULL REFERENCES public.events(id),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  previous_status TEXT NOT NULL DEFAULT 'WHITE',
  proposed_status TEXT NOT NULL DEFAULT 'WHITE',
  final_status TEXT NOT NULL DEFAULT 'WHITE',
  llm_confidence NUMERIC DEFAULT 0,
  reasoning_summary TEXT,
  contradiction_detected BOOLEAN DEFAULT false,
  key_evidence TEXT[] DEFAULT '{}',
  legal_transition BOOLEAN DEFAULT true,
  illegal_transition_reason TEXT,
  guardrails_applied TEXT[] DEFAULT '{}',
  scores_snapshot JSONB,
  booleans_snapshot JSONB,
  model TEXT,
  prompt_version TEXT,
  config_snapshot JSONB,
  observation_score_proposal JSONB
);

-- Enable RLS
ALTER TABLE public.need_audits ENABLE ROW LEVEL SECURITY;

-- Admins can manage all audits
CREATE POLICY "Admins can manage need audits"
  ON public.need_audits FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Authenticated users can view audits
CREATE POLICY "Authenticated can view need audits"
  ON public.need_audits FOR SELECT
  USING (true);

-- Index for common queries
CREATE INDEX idx_need_audits_sector_cap ON public.need_audits(sector_id, capability_id);
CREATE INDEX idx_need_audits_event ON public.need_audits(event_id);
CREATE INDEX idx_need_audits_timestamp ON public.need_audits(timestamp DESC);

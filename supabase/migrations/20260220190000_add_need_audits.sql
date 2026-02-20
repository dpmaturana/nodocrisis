-- Create need_audits table to persist NeedLevelEngine audit records
CREATE TABLE public.need_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id UUID REFERENCES public.sectors(id) ON DELETE CASCADE NOT NULL,
  capability_id UUID REFERENCES public.capacity_types(id) ON DELETE CASCADE NOT NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  previous_status TEXT NOT NULL,
  proposed_status TEXT NOT NULL,
  final_status TEXT NOT NULL,
  llm_confidence DECIMAL(4,3) NOT NULL DEFAULT 0,
  reasoning_summary TEXT NOT NULL,
  contradiction_detected BOOLEAN NOT NULL DEFAULT false,
  key_evidence TEXT[] NOT NULL DEFAULT '{}',
  legal_transition BOOLEAN NOT NULL DEFAULT true,
  illegal_transition_reason TEXT,
  guardrails_applied TEXT[] NOT NULL DEFAULT '{}',
  scores_snapshot JSONB,
  booleans_snapshot JSONB,
  model TEXT,
  prompt_version TEXT,
  config_snapshot JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookup by sector + capability (most common query pattern)
CREATE INDEX need_audits_sector_capability_idx ON public.need_audits(sector_id, capability_id);

-- Index for lookup by sector (for sector-level activity log)
CREATE INDEX need_audits_sector_idx ON public.need_audits(sector_id);

-- RLS: readable by authenticated users of the same event
ALTER TABLE public.need_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "need_audits_select" ON public.need_audits
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "need_audits_insert" ON public.need_audits
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

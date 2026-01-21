-- Create field_reports table for audio recordings from field actors
CREATE TABLE public.field_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  sector_id UUID NOT NULL REFERENCES public.sectors(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL,
  audio_url TEXT NOT NULL,
  transcript TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'transcribing', 'extracting', 'completed', 'failed')),
  extracted_data JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.field_reports ENABLE ROW LEVEL SECURITY;

-- Actors can view their own reports
CREATE POLICY "Users can view their own field reports"
ON public.field_reports
FOR SELECT
USING (auth.uid() = actor_id);

-- Actors can create their own reports
CREATE POLICY "Users can create their own field reports"
ON public.field_reports
FOR INSERT
WITH CHECK (auth.uid() = actor_id);

-- Actors can update their own reports (for status updates via edge function we use service role)
CREATE POLICY "Users can update their own field reports"
ON public.field_reports
FOR UPDATE
USING (auth.uid() = actor_id);

-- Admins can view all reports
CREATE POLICY "Admins can view all field reports"
ON public.field_reports
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can manage all reports
CREATE POLICY "Admins can manage all field reports"
ON public.field_reports
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create signals table for extracted observations
CREATE TABLE public.signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  sector_id UUID REFERENCES public.sectors(id) ON DELETE SET NULL,
  signal_type TEXT NOT NULL CHECK (signal_type IN ('sms', 'field_report', 'actor_report', 'news', 'social', 'official', 'context')),
  level TEXT NOT NULL DEFAULT 'sector' CHECK (level IN ('event', 'sector')),
  content TEXT NOT NULL,
  source TEXT NOT NULL,
  confidence NUMERIC NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  field_report_id UUID REFERENCES public.field_reports(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view signals
CREATE POLICY "Authenticated can view signals"
ON public.signals
FOR SELECT
USING (true);

-- Admins can manage signals
CREATE POLICY "Admins can manage signals"
ON public.signals
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at on field_reports
CREATE TRIGGER update_field_reports_updated_at
BEFORE UPDATE ON public.field_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for field audio recordings
INSERT INTO storage.buckets (id, name, public)
VALUES ('field-audio', 'field-audio', false);

-- Storage policies for field-audio bucket
-- Users can upload to their own folder
CREATE POLICY "Users can upload their own audio"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'field-audio' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can view their own audio
CREATE POLICY "Users can view their own audio"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'field-audio' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Admins can view all audio
CREATE POLICY "Admins can view all field audio"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'field-audio' 
  AND has_role(auth.uid(), 'admin'::app_role)
);
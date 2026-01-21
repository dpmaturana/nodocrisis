-- Add text_note column to field_reports table
ALTER TABLE public.field_reports 
ADD COLUMN IF NOT EXISTS text_note TEXT;
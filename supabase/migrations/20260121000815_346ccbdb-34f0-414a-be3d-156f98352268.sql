-- Crear ENUMs para el nuevo flujo
CREATE TYPE report_status AS ENUM ('draft', 'confirmed', 'discarded');
CREATE TYPE event_priority AS ENUM ('low', 'medium', 'high', 'critical');

-- Tabla para reportes de situación inicial (borradores IA)
CREATE TABLE public.initial_situation_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES auth.users(id),
  status report_status NOT NULL DEFAULT 'draft',
  input_text TEXT NOT NULL,
  event_name_suggested TEXT,
  event_type TEXT,
  summary TEXT,
  suggested_sectors JSONB DEFAULT '[]',
  suggested_capabilities JSONB DEFAULT '[]',
  sources JSONB DEFAULT '[]',
  overall_confidence NUMERIC(3,2),
  linked_event_id UUID REFERENCES public.events(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabla para necesidades a nivel EVENTO (no sector)
CREATE TABLE public.event_context_needs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  capacity_type_id UUID NOT NULL REFERENCES public.capacity_types(id),
  priority event_priority NOT NULL DEFAULT 'high',
  source_type TEXT NOT NULL,
  notes TEXT,
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '24 hours'),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Agregar columna type a events si no existe
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS type TEXT;

-- Agregar columnas source y confidence a sectors si no existen
ALTER TABLE public.sectors 
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS confidence NUMERIC(3,2);

-- Habilitar RLS en las nuevas tablas
ALTER TABLE public.initial_situation_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_context_needs ENABLE ROW LEVEL SECURITY;

-- RLS para initial_situation_reports: solo admins
CREATE POLICY "Admins can manage situation reports"
ON public.initial_situation_reports
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- RLS para event_context_needs: admins CRUD
CREATE POLICY "Admins can manage event context needs"
ON public.event_context_needs
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- RLS para event_context_needs: authenticated pueden ver
CREATE POLICY "Authenticated can view event context needs"
ON public.event_context_needs
FOR SELECT
USING (true);

-- Trigger para updated_at en initial_situation_reports
CREATE TRIGGER update_initial_situation_reports_updated_at
BEFORE UPDATE ON public.initial_situation_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_initial_situation_reports_status ON public.initial_situation_reports(status);
CREATE INDEX idx_initial_situation_reports_created_by ON public.initial_situation_reports(created_by);
CREATE INDEX idx_event_context_needs_event_id ON public.event_context_needs(event_id);
CREATE INDEX idx_event_context_needs_capacity_type_id ON public.event_context_needs(capacity_type_id);
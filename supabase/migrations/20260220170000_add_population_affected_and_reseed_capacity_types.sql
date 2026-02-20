-- Add population_affected column to events table
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS population_affected INTEGER;

-- Add population_affected column to sectors table
ALTER TABLE public.sectors
  ADD COLUMN IF NOT EXISTS population_affected INTEGER;

-- Re-seed default capacity_types in case the table was cleaned
-- Uses ON CONFLICT on the unique(name) constraint to avoid duplicates
INSERT INTO public.capacity_types (name, description, icon) VALUES
  ('agua', 'Suministro de agua potable', 'droplet'),
  ('alimentos', 'Distribución de alimentos', 'utensils'),
  ('salud', 'Atención médica y primeros auxilios', 'heart-pulse'),
  ('rescate', 'Operaciones de búsqueda y rescate', 'life-buoy'),
  ('albergue', 'Refugio y hospedaje temporal', 'home'),
  ('logistica', 'Transporte y distribución', 'truck'),
  ('energia', 'Generadores y suministro eléctrico', 'zap'),
  ('comunicaciones', 'Equipos de comunicación', 'radio')
ON CONFLICT (name) DO NOTHING;

-- Set criticality_level for any newly re-seeded rows that lack it
UPDATE public.capacity_types
SET criticality_level = CASE name
  WHEN 'salud'           THEN 'life_threatening'
  WHEN 'logistica'       THEN 'medium'
  WHEN 'comunicaciones'  THEN 'medium'
  ELSE 'high'
END
WHERE name IN ('agua', 'alimentos', 'salud', 'rescate', 'albergue', 'logistica', 'energia', 'comunicaciones')
  AND criticality_level IS NULL;

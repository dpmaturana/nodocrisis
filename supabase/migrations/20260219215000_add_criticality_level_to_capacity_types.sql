-- Add criticality_level column to capacity_types table
-- Aligns the DB schema with the CapacityType TypeScript type in src/types/database.ts

ALTER TABLE public.capacity_types
  ADD COLUMN criticality_level TEXT CHECK (criticality_level IN ('life_threatening', 'high', 'medium', 'low'));

-- Populate criticality_level for existing default capacity types
UPDATE public.capacity_types SET criticality_level = 'high'             WHERE name = 'agua';
UPDATE public.capacity_types SET criticality_level = 'high'             WHERE name = 'alimentos';
UPDATE public.capacity_types SET criticality_level = 'life_threatening' WHERE name = 'salud';
UPDATE public.capacity_types SET criticality_level = 'high'             WHERE name = 'rescate';
UPDATE public.capacity_types SET criticality_level = 'high'             WHERE name = 'albergue';
UPDATE public.capacity_types SET criticality_level = 'medium'           WHERE name = 'logistica';
UPDATE public.capacity_types SET criticality_level = 'high'             WHERE name = 'energia';
UPDATE public.capacity_types SET criticality_level = 'medium'           WHERE name = 'comunicaciones';

-- Step 1: Create a new PRD-aligned deployment_status enum
CREATE TYPE deployment_status_new AS ENUM ('interested', 'confirmed', 'operating', 'suspended', 'finished');

-- Step 2: Alter the deployments table to use the new enum
ALTER TABLE deployments 
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE deployment_status_new USING 
    CASE status::text
      WHEN 'planned' THEN 'interested'::deployment_status_new
      WHEN 'active' THEN 'operating'::deployment_status_new
      WHEN 'completed' THEN 'finished'::deployment_status_new
      WHEN 'cancelled' THEN 'suspended'::deployment_status_new
      ELSE 'interested'::deployment_status_new
    END,
  ALTER COLUMN status SET DEFAULT 'interested'::deployment_status_new;

-- Step 3: Drop old enum and rename new one
DROP TYPE deployment_status;
ALTER TYPE deployment_status_new RENAME TO deployment_status;

-- Step 4: Create test data - Event
INSERT INTO events (id, name, type, status, location, description, started_at)
VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Incendio Forestal - Región de Valparaíso',
  'incendio_forestal',
  'active',
  'Valparaíso, Chile',
  'Evento de prueba para desarrollo y testing del sistema',
  now()
) ON CONFLICT (id) DO NOTHING;

-- Step 5: Create test sectors
INSERT INTO sectors (id, event_id, canonical_name, status, source, latitude, longitude)
VALUES 
  ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Villa Alemana Centro', 'unresolved', 'manual', -33.0472, -71.3703),
  ('b2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Quilpué Norte', 'unresolved', 'manual', -33.0458, -71.4427),
  ('b3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Limache Sur', 'tentative', 'manual', -33.0167, -71.2667)
ON CONFLICT (id) DO NOTHING;

-- Step 6: Create capacity types
INSERT INTO capacity_types (id, name, description, icon)
VALUES 
  ('c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a55', 'Bomberos', 'Brigadas de extinción de incendios', 'flame'),
  ('c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a66', 'Rescate', 'Equipos de búsqueda y rescate', 'search'),
  ('c3eebc99-9c0b-4ef8-bb6d-6bb9bd380a77', 'Médico', 'Personal médico y paramédico', 'heart-pulse'),
  ('c4eebc99-9c0b-4ef8-bb6d-6bb9bd380a88', 'Logística', 'Apoyo logístico y suministros', 'truck'),
  ('c5eebc99-9c0b-4ef8-bb6d-6bb9bd380a99', 'Voluntarios', 'Voluntarios de apoyo general', 'users')
ON CONFLICT (id) DO NOTHING;
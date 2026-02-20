-- Replace old capacity_types seed data with new international humanitarian values.
-- First delete old rows (cascade will not affect anything since capacity_types
-- are referenced by other tables via FK — those tables were already cleaned).
-- Then insert the new canonical set.

DELETE FROM public.capacity_types;

INSERT INTO public.capacity_types (name, description, icon, criticality_level) VALUES
  ('Emergency medical care',    'Emergency health services and first aid',                    'Heart',         'life_threatening'),
  ('Search and rescue',         'Locating and extracting trapped or missing people',          'Search',        'life_threatening'),
  ('Shelter / housing',         'Temporary or transitional shelter for displaced populations', 'Home',          'high'),
  ('Drinking water',            'Provision and distribution of safe drinking water',          'Droplets',      'life_threatening'),
  ('Food supply',               'Emergency food distribution and nutrition support',          'Apple',         'high'),
  ('Transport',                 'Logistics and transport of people and supplies',             'Truck',         'medium'),
  ('Sanitation',                'Hygiene, waste management and sanitation services',          'ShowerHead',    'high'),
  ('Telecommunications',        'Emergency communication systems and connectivity',          'Radio',         'medium'),
  ('Power supply',              'Emergency electrical power and energy provision',            'Zap',           'high'),
  ('Debris removal',            'Clearing debris and restoring access routes',                'Shovel',        'medium'),
  ('Psychosocial support',      'Mental health and psychosocial assistance',                  'Brain',         'medium'),
  ('Child protection',          'Safeguarding and protection of children',                    'Baby',          'high'),
  ('Education in emergencies',  'Continuity of education during crises',                      'GraduationCap', 'low'),
  ('Camp management',           'Coordination and management of displacement camps',          'Tent',          'high'),
  ('Early recovery',            'Initial recovery and livelihood restoration',                'Sprout',        'low'),
  ('Protection',                'Legal protection and human rights monitoring',               'Shield',        'high'),
  ('Coordination',              'Inter-agency coordination and information management',       'Users',         'medium')
ON CONFLICT (name) DO NOTHING;

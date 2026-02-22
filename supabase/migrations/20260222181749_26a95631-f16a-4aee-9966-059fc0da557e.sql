ALTER TABLE capacity_types
  ADD COLUMN criticality_level text NOT NULL DEFAULT 'medium';

UPDATE capacity_types SET criticality_level = 'life_threatening'
  WHERE name IN ('Emergency medical care', 'Search and rescue', 'Drinking water');
UPDATE capacity_types SET criticality_level = 'high'
  WHERE name IN ('Food supply', 'Shelter / housing', 'Child protection', 'Protection', 'Sanitation');
UPDATE capacity_types SET criticality_level = 'low'
  WHERE name IN ('Education in emergencies', 'Early recovery', 'Coordination');
// NodoCrisis Types
// These types complement the auto-generated Supabase types

export type AppRole = 'admin' | 'actor';

export type NeedLevel = 'low' | 'medium' | 'high' | 'critical';

// PRD-aligned deployment lifecycle
export type DeploymentStatus = 'interested' | 'confirmed' | 'operating' | 'suspended' | 'finished';

// PRD-aligned gap states
export type GapState = 'evaluating' | 'critical' | 'partial' | 'active';

// Event phase for dashboard header
export type EventPhase = 'stable' | 'unstable' | 'critical';

// Signal types for gap evidence
export type SignalType = 'sms' | 'field_report' | 'actor_report' | 'news' | 'social' | 'official' | 'context';
export type SignalLevel = 'event' | 'sector';

export type AvailabilityStatus = 'ready' | 'limited' | 'unavailable';

export type SectorStatus = 'unresolved' | 'tentative' | 'resolved';

export type ReportStatus = 'draft' | 'confirmed' | 'discarded';

export type EventPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Profile {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  organization_name: string | null;
  organization_type: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface Event {
  id: string;
  name: string;
  type: string | null;
  description: string | null;
  location: string | null;
  status: string;
  started_at: string;
  ended_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CapacityType {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  created_at: string;
}

export interface Sector {
  id: string;
  event_id: string;
  canonical_name: string;
  aliases: string[] | null;
  latitude: number | null;
  longitude: number | null;
  status: SectorStatus;
  source: string | null;
  confidence: number | null;
  created_at: string;
  updated_at: string;
}

export interface SectorNeedsSms {
  id: string;
  event_id: string;
  sector_id: string;
  capacity_type_id: string;
  level: NeedLevel;
  count: number;
  evidence_text: string | null;
  confidence_score: number | null;
  created_at: string;
}

export interface SectorNeedsContext {
  id: string;
  event_id: string;
  sector_id: string;
  capacity_type_id: string;
  level: NeedLevel;
  source: string;
  notes: string | null;
  created_by: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface ActorCapability {
  id: string;
  user_id: string;
  capacity_type_id: string;
  quantity: number | null;
  unit: string | null;
  availability: AvailabilityStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Deployment {
  id: string;
  event_id: string;
  sector_id: string;
  capacity_type_id: string;
  actor_id: string;
  status: DeploymentStatus;
  notes: string | null;
  verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface SmsMessage {
  id: string;
  event_id: string | null;
  phone_number: string;
  message_text: string;
  received_at: string;
  processed: boolean;
  extracted_need_type: string | null;
  extracted_places: string[] | null;
  confidence_score: number | null;
  created_at: string;
}

// New types for AI-first flow
export interface SuggestedSector {
  name: string;
  description: string;
  confidence: number;
  include: boolean;
}

export interface SuggestedCapability {
  capability_name: string;
  confidence: number;
  include: boolean;
}

export interface InitialSituationReport {
  id: string;
  created_by: string | null;
  status: ReportStatus;
  input_text: string;
  event_name_suggested: string | null;
  event_type: string | null;
  summary: string | null;
  suggested_sectors: SuggestedSector[];
  suggested_capabilities: SuggestedCapability[];
  sources: string[];
  overall_confidence: number | null;
  linked_event_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventContextNeed {
  id: string;
  event_id: string;
  capacity_type_id: string;
  priority: EventPriority;
  source_type: string;
  notes: string | null;
  expires_at: string | null;
  created_by: string | null;
  created_at: string;
}

// Gap entity (PRD-aligned)
export interface Gap {
  id: string;
  event_id: string;
  sector_id: string;
  capacity_type_id: string;
  state: GapState;
  last_updated_at: string;
  signal_count: number;
}

// Signal entity for gap evidence
export interface Signal {
  id: string;
  event_id: string;
  sector_id: string | null;
  signal_type: SignalType;
  level: SignalLevel;
  content: string;
  source: string;
  confidence: number;
  created_at: string;
}

// Computed types for gap analysis (legacy, kept for compatibility)
export interface SectorGap {
  sector: Sector;
  capacityType: CapacityType;
  smsDemand: number;
  contextDemand: number;
  totalDemand: number;
  coverage: number;
  gap: number;
  isUncovered: boolean;
  isCritical: boolean;
  maxLevel: NeedLevel;
}

export interface DashboardStats {
  totalEvents: number;
  activeEvents: number;
  totalSectors: number;
  criticalGaps: number;
  activeDeployments: number;
  registeredActors: number;
}

// Event types for dropdown
export const EVENT_TYPES = [
  { value: 'incendio_forestal', label: 'Incendio Forestal' },
  { value: 'inundacion', label: 'Inundación' },
  { value: 'terremoto', label: 'Terremoto' },
  { value: 'tsunami', label: 'Tsunami' },
  { value: 'aluvion', label: 'Aluvión' },
  { value: 'sequia', label: 'Sequía' },
  { value: 'temporal', label: 'Temporal' },
  { value: 'accidente_masivo', label: 'Accidente Masivo' },
  { value: 'emergencia_sanitaria', label: 'Emergencia Sanitaria' },
  { value: 'otro', label: 'Otro' },
] as const;

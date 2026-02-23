// Field Report Types for Audio Recording Flow

export type FieldReportStatus = 'pending' | 'transcribing' | 'extracting' | 'completed' | 'failed';

export interface ExtractedItem {
  name: string;
  quantity: number | null;
  unit: string;
  state: 'available' | 'needed' | 'in_transit' | 'depleted' | 'disponible' | 'necesario' | 'en_camino' | 'agotado';
  urgency: 'low' | 'medium' | 'high' | 'critical' | 'baja' | 'media' | 'alta' | 'crítica';
}

export interface CapabilityExtraction {
  name: string;
  sentiment: 'improving' | 'worsening' | 'stable' | 'unknown';
  items: ExtractedItem[];
  observation: string;
  evidence_quotes: string[];
}

export interface ExtractedData {
  // New per-capability format
  capabilities?: CapabilityExtraction[];
  // Legacy flat fields (always present for backward compat)
  sector_mentioned: string | null;
  capability_types: string[];
  items: ExtractedItem[];
  location_detail: string | null;
  observations: string | null;
  evidence_quotes: string[];
  confidence: number;
}

export interface FieldReport {
  id: string;
  event_id: string;
  sector_id: string;
  actor_id: string;
  audio_url: string;
  transcript: string | null;
  text_note: string | null;
  status: FieldReportStatus;
  extracted_data: ExtractedData | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateFieldReportParams {
  event_id: string;
  sector_id: string;
  audio_file: Blob;
  text_note?: string;
}

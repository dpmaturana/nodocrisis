export interface MapGap {
  capabilityName: string;
  coverage: "none" | "partial" | "full";
  severity: "critical" | "partial";
}

export interface MapSector {
  id: string;
  name: string;
  status: "critical" | "partial" | "operating";
  lat?: number;
  lng?: number;
  gaps: MapGap[];
}

export interface MapViewProps {
  viewerRole: "ngo" | "admin";
  orgCapabilities: string[];
  sectors: MapSector[];
  focusedSectorId?: string | null;
  onSectorFocus?: (sectorId: string | null) => void;
  onSectorClick?: (sectorId: string) => void;
}

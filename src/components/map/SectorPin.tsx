import { CircleMarker, Tooltip } from "react-leaflet";
import { SectorTooltip } from "./SectorTooltip";
import type { MapSector } from "./types";

interface SectorPinProps {
  sector: MapSector;
  viewerRole: "ngo" | "admin";
  orgCapabilities: string[];
  isFocused: boolean;
  onHover: () => void;
  onLeave: () => void;
  onClick: () => void;
}

const statusColors = {
  critical: "#EF4444",  // gap-critical red
  partial: "#F59E0B",   // warning orange
  operating: "#22C55E", // coverage green
};

export function SectorPin({
  sector,
  viewerRole,
  orgCapabilities,
  isFocused,
  onHover,
  onLeave,
  onClick,
}: SectorPinProps) {
  if (sector.lat == null || sector.lng == null) {
    return null;
  }

  const color = statusColors[sector.status];

  return (
    <CircleMarker
      center={[sector.lat, sector.lng]}
      radius={isFocused ? 14 : 10}
      pathOptions={{
        color: isFocused ? "#fff" : color,
        fillColor: color,
        fillOpacity: isFocused ? 1 : 0.8,
        weight: isFocused ? 3 : 2,
      }}
      eventHandlers={{
        mouseover: onHover,
        mouseout: onLeave,
        click: onClick,
      }}
    >
      <Tooltip 
        direction="top" 
        offset={[0, -10]}
        opacity={1}
      >
        <SectorTooltip
          sector={sector}
          viewerRole={viewerRole}
          orgCapabilities={orgCapabilities}
        />
      </Tooltip>
    </CircleMarker>
  );
}

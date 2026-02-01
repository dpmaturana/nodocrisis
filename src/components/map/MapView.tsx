import { useMemo, useEffect } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import { SectorPin } from "./SectorPin";
import type { MapViewProps, MapSector } from "./types";
import "leaflet/dist/leaflet.css";

// Component to handle map centering on focused sector
function MapController({ 
  focusedSectorId, 
  sectors 
}: { 
  focusedSectorId: string | null; 
  sectors: MapSector[];
}) {
  const map = useMap();

  useEffect(() => {
    if (!focusedSectorId) return;
    
    const sector = sectors.find(s => s.id === focusedSectorId);
    if (sector?.lat != null && sector?.lng != null) {
      map.setView([sector.lat, sector.lng], map.getZoom(), { animate: true });
    }
  }, [focusedSectorId, sectors, map]);

  return null;
}

export function MapView({
  viewerRole,
  orgCapabilities,
  sectors,
  focusedSectorId,
  onSectorFocus,
  onSectorClick,
}: MapViewProps) {
  // Filter sectors with valid coordinates
  const validSectors = useMemo(
    () => sectors.filter(s => s.lat != null && s.lng != null),
    [sectors]
  );

  // Calculate map center from valid sectors
  const center = useMemo<[number, number]>(() => {
    if (validSectors.length === 0) {
      // Default to Chile center
      return [-33.45, -70.67];
    }

    const sumLat = validSectors.reduce((acc, s) => acc + (s.lat || 0), 0);
    const sumLng = validSectors.reduce((acc, s) => acc + (s.lng || 0), 0);

    return [sumLat / validSectors.length, sumLng / validSectors.length];
  }, [validSectors]);

  // Calculate appropriate zoom level based on sector spread
  const zoom = useMemo(() => {
    if (validSectors.length <= 1) return 11;
    
    const lats = validSectors.map(s => s.lat!);
    const lngs = validSectors.map(s => s.lng!);
    const latSpread = Math.max(...lats) - Math.min(...lats);
    const lngSpread = Math.max(...lngs) - Math.min(...lngs);
    const maxSpread = Math.max(latSpread, lngSpread);
    
    if (maxSpread > 2) return 7;
    if (maxSpread > 1) return 8;
    if (maxSpread > 0.5) return 9;
    return 10;
  }, [validSectors]);

  if (validSectors.length === 0) {
    return (
      <div className="sticky top-14 z-10 bg-background">
        <div className="h-[40vh] min-h-[250px] max-h-[45vh] rounded-lg overflow-hidden border border-border bg-muted flex items-center justify-center">
          <p className="text-muted-foreground text-sm">No sectors with coordinates available</p>
        </div>
        <div className="h-6 bg-background" />
      </div>
    );
  }

  return (
    <div className="sticky top-14 z-10 bg-background">
      <div className="h-[40vh] min-h-[250px] max-h-[45vh] rounded-lg overflow-hidden border border-border shadow-lg">
        <MapContainer
          center={center}
          zoom={zoom}
          className="h-full w-full"
          scrollWheelZoom={true}
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapController focusedSectorId={focusedSectorId ?? null} sectors={validSectors} />
          {validSectors.map(sector => (
            <SectorPin
              key={sector.id}
              sector={sector}
              viewerRole={viewerRole}
              orgCapabilities={orgCapabilities}
              isFocused={focusedSectorId === sector.id}
              onHover={() => onSectorFocus?.(sector.id)}
              onLeave={() => onSectorFocus?.(null)}
              onClick={() => onSectorClick?.(sector.id)}
            />
          ))}
        </MapContainer>
      </div>
      <div className="h-6 bg-background" />
    </div>
  );
}


# Plan: MapView Sticky Component with Smart Tooltips

## Overview

Build a `MapView` component for NodoCrisis that displays sector pins on a map with role-aware tooltips (NGO vs Admin) and bidirectional synchronization with sector cards.

## Technical Architecture

### New Dependencies
| Package | Version | Purpose |
|---------|---------|---------|
| `react-leaflet` | ^4.2.1 | React bindings for Leaflet |
| `leaflet` | ^1.9.4 | Map rendering library |
| `@types/leaflet` | ^1.9.8 | TypeScript definitions |

### New Files
| File | Description |
|------|-------------|
| `src/components/map/MapView.tsx` | Main map component with pins and tooltips |
| `src/components/map/SectorPin.tsx` | Individual pin with hover/click behavior |
| `src/components/map/SectorTooltip.tsx` | Role-aware tooltip content |
| `src/hooks/useSectorFocus.ts` | State management for map-list sync |

### Modified Files
| File | Changes |
|------|---------|
| `src/pages/Sectors.tsx` | Integrate MapView above card list |
| `src/components/sectors/SectorCard.tsx` | Add `id` attribute for scroll targeting, hover callbacks |

## Component Design

### 1. MapView Props Interface

```typescript
interface MapViewProps {
  viewerRole: "ngo" | "admin";
  orgCapabilities: string[];  // Capability names for NGO filtering
  sectors: MapSector[];
  focusedSectorId?: string;
  onSectorFocus?: (sectorId: string | null) => void;
  onSectorClick?: (sectorId: string) => void;
}

interface MapSector {
  id: string;
  name: string;
  status: "critical" | "partial" | "operating";
  lat?: number;
  lng?: number;
  gaps: MapGap[];
}

interface MapGap {
  capabilityName: string;
  coverage: "none" | "partial" | "full";
  severity: "critical" | "partial";
}
```

### 2. Layout Structure

The map will be sticky at the top (25-35% viewport height) with cards scrolling beneath:

```
+------------------------------------------+
|  [HEADER: Where your organization...]    |
+------------------------------------------+
|                                          |
|              STICKY MAP                  |
|         (25-35vh, z-index: 10)           |
|                                          |
+------------------------------------------+
|                                          |
|           SCROLLABLE CARDS               |
|         (id="sector-{sectorId}")         |
|                                          |
+------------------------------------------+
```

### 3. Pin Rendering Logic

- Only render pins for sectors with valid `lat` and `lng` values
- Pin color based on `sector.status`:
  - `critical` = Red (`#EF4444`, gap-critical)
  - `partial` = Orange (`#F59E0B`, warning)
  - `operating` = Green (`#22C55E`, coverage)

### 4. Tooltip Content by Role

**Admin View:**
```
San Carlos Rural
🔴 Critical sector
Missing: Water, Fire control, Transport (+2)
```

**NGO View:**
```
San Carlos Rural
🔴 Critical sector
You can provide: Transport, Food (+1)
Other gaps in sector: +3
```

Tooltip logic:
1. Filter gaps where `coverage !== "full"`
2. Sort: `severity === "critical"` first, then alphabetically by `capabilityName`
3. Show max 3, then `(+N more)`
4. For NGO: intersect with `orgCapabilities`, show "Other gaps" count separately

### 5. Map-List Synchronization

| Action | Map Response | List Response |
|--------|--------------|---------------|
| Hover pin | Show tooltip, highlight pin | Highlight card border (no scroll) |
| Click pin | Center map on pin | Scroll to card, highlight 2s |
| Hover card | Center map, highlight pin | - |
| Click card | - | Open detail drawer |

### 6. Scroll Implementation

```typescript
const scrollToCard = (sectorId: string) => {
  const card = document.getElementById(`sector-${sectorId}`);
  if (card) {
    const headerOffset = 48; // Account for sticky header
    const mapHeight = window.innerHeight * 0.3; // ~30vh
    const elementPosition = card.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - headerOffset - mapHeight - 16;
    
    window.scrollTo({ top: offsetPosition, behavior: "smooth" });
    
    // Highlight animation
    card.classList.add("ring-2", "ring-primary", "ring-offset-2");
    setTimeout(() => {
      card.classList.remove("ring-2", "ring-primary", "ring-offset-2");
    }, 2000);
  }
};
```

## Implementation Steps

### Step 1: Install Dependencies
Add `react-leaflet`, `leaflet`, and `@types/leaflet` to the project.

### Step 2: Add Leaflet CSS
Import Leaflet styles in `index.css`:
```css
@import "leaflet/dist/leaflet.css";
```

### Step 3: Create useSectorFocus Hook
Manage synchronized focus state between map and list:
```typescript
export function useSectorFocus() {
  const [focusedSectorId, setFocusedSectorId] = useState<string | null>(null);
  const [highlightedCardId, setHighlightedCardId] = useState<string | null>(null);
  
  const scrollToCard = (sectorId: string) => { /* ... */ };
  
  return { focusedSectorId, highlightedCardId, setFocusedSectorId, scrollToCard };
}
```

### Step 4: Create MapView Component

Main component structure:
```typescript
export function MapView({ viewerRole, orgCapabilities, sectors, ... }: MapViewProps) {
  const validSectors = sectors.filter(s => s.lat != null && s.lng != null);
  
  // Calculate map center from valid sectors
  const center = useMemo(() => { /* ... */ }, [validSectors]);
  
  return (
    <div className="sticky top-0 z-10 h-[30vh] min-h-[200px] max-h-[35vh] rounded-lg overflow-hidden border">
      <MapContainer center={center} zoom={10} className="h-full w-full">
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
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
  );
}
```

### Step 5: Create SectorPin Component

Custom pin with Leaflet's `CircleMarker` or `Marker`:
```typescript
export function SectorPin({ sector, viewerRole, orgCapabilities, isFocused, ... }: SectorPinProps) {
  const color = getStatusColor(sector.status);
  
  return (
    <CircleMarker
      center={[sector.lat!, sector.lng!]}
      radius={isFocused ? 12 : 8}
      pathOptions={{ color, fillColor: color, fillOpacity: 0.8 }}
      eventHandlers={{
        mouseover: onHover,
        mouseout: onLeave,
        click: onClick,
      }}
    >
      <Tooltip permanent={false}>
        <SectorTooltip 
          sector={sector} 
          viewerRole={viewerRole} 
          orgCapabilities={orgCapabilities} 
        />
      </Tooltip>
    </CircleMarker>
  );
}
```

### Step 6: Create SectorTooltip Component

Role-aware tooltip content:
```typescript
export function SectorTooltip({ sector, viewerRole, orgCapabilities }: SectorTooltipProps) {
  const statusIcon = { critical: "🔴", partial: "🟠", operating: "🟢" }[sector.status];
  const statusLabel = { critical: "Critical sector", partial: "Partial sector", operating: "Operating" }[sector.status];
  
  // Filter and sort missing gaps
  const missingGaps = sector.gaps
    .filter(g => g.coverage !== "full")
    .sort((a, b) => { /* critical first, then alphabetical */ });
  
  if (viewerRole === "admin") {
    return <AdminTooltip sector={sector} missingGaps={missingGaps} />;
  }
  
  // NGO view - intersect with orgCapabilities
  const matchingGaps = missingGaps.filter(g => orgCapabilities.includes(g.capabilityName));
  const otherGapsCount = missingGaps.length - matchingGaps.length;
  
  return <NgoTooltip sector={sector} matchingGaps={matchingGaps} otherGapsCount={otherGapsCount} />;
}
```

### Step 7: Integrate into Sectors Page

Update `src/pages/Sectors.tsx`:
```typescript
export default function Sectors() {
  const { focusedSectorId, scrollToCard, setFocusedSectorId } = useSectorFocus();
  
  // Transform EnrichedSector[] to MapSector[]
  const mapSectors = useMemo(() => transformToMapSectors(sectors), [sectors]);
  
  return (
    <div className="space-y-6">
      {/* Header */}
      
      {/* Sticky Map */}
      {mapSectors.length > 0 && (
        <MapView
          viewerRole={isAdmin ? "admin" : "ngo"}
          orgCapabilities={userCapabilities.map(c => c.capacityType?.name)}
          sectors={mapSectors}
          focusedSectorId={focusedSectorId}
          onSectorFocus={setFocusedSectorId}
          onSectorClick={scrollToCard}
        />
      )}
      
      {/* Sector Cards with IDs */}
      {sectors.map(sector => (
        <div 
          key={sector.sector.id}
          id={`sector-${sector.sector.id}`}
          onMouseEnter={() => setFocusedSectorId(sector.sector.id)}
          onMouseLeave={() => setFocusedSectorId(null)}
        >
          <SectorCard
            sector={sector}
            isHighlighted={focusedSectorId === sector.sector.id}
            // ...existing props
          />
        </div>
      ))}
    </div>
  );
}
```

### Step 8: Update SectorCard for Highlighting

Add highlight state to `SectorCard.tsx`:
```typescript
interface SectorCardProps {
  // ...existing
  isHighlighted?: boolean;
}

// In component:
<Card className={cn(
  config.borderClass, 
  config.bgClass,
  isHighlighted && "ring-2 ring-primary ring-offset-2 ring-offset-background transition-all duration-300"
)} />
```

## Technical Considerations

### Map Tile Attribution
OpenStreetMap requires attribution. Include in footer of map or corner.

### Default Map Center
Calculate centroid of all valid sector coordinates. Fallback to Chile center (`-33.45, -70.67`) if no valid coords.

### Zoom Level
- Default zoom: 10 (shows ~50km radius)
- When centering on pin: zoom 12 (closer)
- No aggressive auto-zoom on hover

### Performance
- Memoize `mapSectors` transformation
- Use `useMemo` for center calculation
- Debounce hover events (100ms)

### Mobile Considerations
- Map height: 25vh on mobile, 30vh on desktop
- Touch-friendly pin size (min 44px tap target)
- Scroll-to-card respects safe areas

## Estimated Credits
- Dependencies + setup: 1 credit
- MapView + SectorPin + SectorTooltip: 2 credits
- useSectorFocus hook: 1 credit
- Sectors.tsx integration: 1 credit
- SectorCard updates: 1 credit
- Testing and polish: 1 credit

**Total: 6-8 credits**

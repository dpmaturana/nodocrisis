

# Plan: Agregar Mapa al Dashboard de Admin

## Situación Actual

El dashboard de admin (`/admin/event-dashboard`) no incluye el componente `MapView`. Este componente solo está presente en la página `/sectors` que usan los actores/ONGs.

## Solución

Integrar el mismo componente `MapView` en el `EventDashboard` para que los administradores también puedan ver la ubicación geográfica de los sectores con gaps.

## Implementación

### 1. Modificar `src/pages/admin/EventDashboard.tsx`

**Agregar imports necesarios:**
```tsx
import { MapView } from "@/components/map";
import { useSectorFocus } from "@/hooks/useSectorFocus";
import type { MapSector, MapGap } from "@/components/map/types";
```

**Agregar estado y hook para el mapa:**
- Usar `useSectorFocus` para sincronización mapa-cards
- Transformar los sectores de `SectorWithGaps` a formato `MapSector`

**Agregar el componente MapView:**
- Posicionarlo entre `FilterChips` y `SectorGapList`
- Configurar como sticky igual que en `/sectors`
- Pasar `viewerRole="admin"` para mostrar todos los gaps (sin filtro de capacidades)

### 2. Modificar `src/components/dashboard/SectorGapList.tsx`

Agregar soporte para:
- `focusedSectorId` - Para resaltar el sector enfocado
- `onSectorHover` - Callback cuando se hace hover en una card
- IDs en cada card para scroll automático

## Estructura Visual Resultante

```text
+----------------------------------+
|  EventHeader                     |
+----------------------------------+
|  FilterChips                     |
+----------------------------------+
|  ┌──────────────────────────┐   |
|  │     MapView (sticky)      │   |
|  │   - Pins por sector       │   |
|  │   - Colores por severidad │   |
|  └──────────────────────────┘   |
+----------------------------------+
|  SectorCardAdmin #1              |
|  SectorCardAdmin #2              |
|  ...                             |
+----------------------------------+
```

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/pages/admin/EventDashboard.tsx` | Agregar MapView, useSectorFocus, transformar datos a MapSector |
| `src/components/dashboard/SectorGapList.tsx` | Agregar props para sincronización con mapa |
| `src/components/dashboard/SectorCardAdmin.tsx` | Agregar prop `isHighlighted` y eventos de hover |

## Detalles Técnicos

La transformación de datos para el mapa:

```tsx
const mapSectors = useMemo((): MapSector[] => {
  return sectorsWithGaps.map(s => ({
    id: s.sector.id,
    name: s.sector.canonical_name,
    status: s.gapCounts.critical > 0 ? "critical" : "partial",
    lat: s.sector.latitude,
    lng: s.sector.longitude,
    gaps: s.gaps.map(g => ({
      capabilityName: g.capacityType.name,
      coverage: g.state === "critical" ? "none" : "partial",
      severity: g.state,
    })),
  }));
}, [sectorsWithGaps]);
```

## Esfuerzo Estimado
2-3 créditos


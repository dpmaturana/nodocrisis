

## Plan: Conectar "Ver detalles" del Admin Dashboard con el SectorDetailDrawer existente

### Objetivo
Hacer que el botón "Ver detalles" en cada sector del Admin Dashboard abra el mismo drawer que se usa en `/sectors`, mostrando el contexto completo del sector (resumen operativo, brechas, actores apoyando, señales recientes).

### Cambio Principal

El `SectorDetailDrawer` espera un tipo `EnrichedSector` que incluye:
- `sector`, `event`, `state`
- `context` (resumen operativo, acceso, aislamiento, etc.)
- `gaps` (todas las brechas del sector)
- `relevantGaps` (brechas que matchean con capacidades del actor - no aplica para admin)
- `actorsInSector` (actores operando/confirmados)
- `recentSignals` (últimas señales)

Actualmente el Admin Dashboard tiene datos parciales (`Sector` + `SectorContext` + `GapWithDetails[]`), pero no el formato completo de `EnrichedSector`.

---

## Sección Técnica

### Archivos a Modificar

**1. `src/services/gapService.ts`**
Agregar nuevo método para obtener un `EnrichedSector` por `sectorId`:
```typescript
async getEnrichedSectorById(sectorId: string): Promise<EnrichedSector | null>
```
Este método reutiliza la lógica existente pero para un solo sector, sin filtrar por capacidades del actor.

**2. `src/pages/admin/EventDashboard.tsx`**
- Agregar estado: `selectedSector: EnrichedSector | null`
- Agregar estado: `showSectorDrawer: boolean`
- Modificar `handleViewSectorDetails`:
  - Llamar a `gapService.getEnrichedSectorById(sectorId)`
  - Setear el sector y abrir el drawer
- Agregar `SectorDetailDrawer` con `hideEnrollButton={true}` (admin no se inscribe)

**3. `src/components/dashboard/SectorGapList.tsx`**
Modificar el callback `onViewSectorDetails` para que también reciba el `sectorId` (ya lo hace).

**4. `src/services/sectorService.ts`** (alternativa)
Si preferimos mantener la lógica de enriquecer sectores en un solo lugar, agregar:
```typescript
async getEnrichedSectorById(sectorId: string): Promise<EnrichedSector | null>
```

### Flujo de Datos

```text
Admin Dashboard
     |
     v
Click "Ver detalles"
     |
     v
handleViewSectorDetails(sectorId)
     |
     v
gapService.getEnrichedSectorById(sectorId)
     |
     v
setSelectedSector(enrichedSector)
setShowSectorDrawer(true)
     |
     v
<SectorDetailDrawer 
   sector={selectedSector}
   hideEnrollButton={true}
/>
```

### Propiedades del Drawer para Admin

El `SectorDetailDrawer` ya tiene una prop `hideEnrollButton` que oculta el CTA de inscripción. Para el admin:
- `hideEnrollButton={true}` - El admin no se inscribe
- `relevantGaps` será igual a `gaps` - El admin ve todas las brechas, no filtradas por capacidades personales

### Implementación del Nuevo Método en gapService

```typescript
async getEnrichedSectorById(sectorId: string): Promise<EnrichedSector | null> {
  await simulateDelay(150);
  
  const sector = getSectorById(sectorId);
  if (!sector) return null;
  
  const event = getEventById(sector.event_id);
  if (!event) return null;
  
  const context = MOCK_SECTOR_CONTEXT[sectorId] || {
    keyPoints: [],
    extendedContext: "",
    operationalSummary: "",
  };
  
  // Get all gaps for this sector
  const sectorGaps = getVisibleGaps(event.id)
    .filter(g => g.sector_id === sectorId);
  
  // Convert to SectorGap format expected by drawer
  const gaps: SectorGap[] = sectorGaps.map(gap => ({
    sector,
    capacityType: getCapacityTypeById(gap.capacity_type_id)!,
    smsDemand: 0,
    contextDemand: gap.state === 'critical' ? 3 : 2,
    totalDemand: gap.state === 'critical' ? 3 : 2,
    coverage: getDeploymentsByGap(gap.sector_id, gap.capacity_type_id).length,
    gap: 1,
    isUncovered: getDeploymentsByGap(gap.sector_id, gap.capacity_type_id).length === 0,
    isCritical: gap.state === 'critical',
    maxLevel: gap.state === 'critical' ? 'critical' : 'high',
  }));
  
  const hasCritical = gaps.some(g => g.isCritical);
  const state: EnrichedSector["state"] = hasCritical ? "critical" : "partial";
  
  const actorsInSector = getActorsInSector(sectorId);
  const recentSignals = getSignalsBySector(sectorId).slice(0, 5);
  
  return {
    sector,
    event,
    state,
    context,
    gaps,
    relevantGaps: gaps, // Admin ve todas
    bestMatchGaps: gaps.slice(0, 2),
    actorsInSector,
    recentSignals,
  };
}
```

### Resultado

Al hacer click en "Ver detalles" en cualquier sector del Admin Dashboard, se abrirá el mismo drawer que ven las ONG en `/sectors`, mostrando:
- Resumen operativo
- Contexto del sector (acceso, aislamiento)
- Brechas activas (todas, no filtradas)
- Actores apoyando en el sector
- Señales recientes

El botón de "Inscribirme" estará oculto ya que el admin no se inscribe.


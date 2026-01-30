
## Plan: Rediseno Completo del Admin Dashboard — Vista por Sector

### Objetivo
Transformar el dashboard de una lista plana de brechas a una estructura sector-centrica donde:
- El sector es el contenedor principal
- Los gaps son filas visibles dentro de cada sector
- Las metricas superiores actuan como filtros clickeables
- Las acciones permiten "Ver senales" y "Activar actores de {capacidad}"

---

## Cambios Estructurales

### Vista Actual vs Vista Nueva

```text
ACTUAL:
+---------------------------+
| Header (evento + fase)    |
+---------------------------+
| [Stat] [Stat] [Stat] [Stat] |  <- Cards estaticas
+---------------------------+
| Card: Atencion Inmediata  |
|   Gap 1 (plano)           |
|   Gap 2 (plano)           |
|   Gap 3 (plano)           |
+---------------------------+
| Collapsible: Monitoreados |  <- Muestra gaps "evaluating"
+---------------------------+

NUEVA (spec):
+---------------------------+
| Header (evento + fase     |
|   + ultima senal + confianza) |
+---------------------------+
| [Chip] [Chip] [Chip] [Chip] |  <- Filtros clickeables
|        + "Limpiar filtros"  |
+---------------------------+
| SECTOR CARD: San Carlos   |
|   Contexto: 2 bullets     |
|   Resumen: X X Y Y        |
|   [Ver detalles]          |
|   +-- Gap Row: Agua       |
|   +-- Gap Row: Transporte |
+---------------------------+
| SECTOR CARD: Niquen       |
|   ...                     |
+---------------------------+
```

---

## Componentes a Modificar/Crear

### 1. EventHeader.tsx (MODIFICAR)
Agregar:
- Ultima senal confiable (timestamp)
- Confianza global (Alta/Media/Baja badge)
- Remover texto "Coordinacion en curso"

### 2. GapMetrics.tsx -> FilterChips.tsx (REEMPLAZAR)
Cambiar de StatCards a chips/badges clickeables:
- "Sectores con gaps" (filtra contenido)
- "X Gaps" (filtra solo gaps rojos)
- "Y Gaps" (filtra solo gaps naranjas)
- "Z Actores operando" (abre modal)
- "Limpiar filtros" siempre visible

### 3. ImmediateAttention.tsx -> SectorGapList.tsx (REEMPLAZAR)
Nueva estructura:
- Agrupa gaps por sector
- Renderiza SectorCard para cada sector con gaps
- Cada SectorCard contiene GapRows visibles

### 4. SectorCard.tsx (CREAR - Dashboard version)
Nueva card de sector para admin dashboard:
- Nombre del sector
- Evento asociado
- Contexto clave (max 2 bullets)
- Resumen de gaps: X Y
- CTA "Ver detalles" -> abre drawer de sector (vista ONG)
- Contiene GapRow children

### 5. GapRow.tsx (CREAR)
Fila de gap dentro de sector card:
```text
[X] Transporte — Cobertura parcial
Reportado por actores en terreno
[ Ver senales ] [ Activar actores de transporte ]
```
- Severity icon (X o Y)
- Capacity name
- Coverage status (text)
- Signal type dominant (copy cerrado)
- CTA: Ver senales (abre modal)
- CTA: Activar actores de {capacidad} (abre drawer)

### 6. SignalsModal.tsx (CREAR)
Modal para "Ver senales":
- Lista de senales agrupadas por tipo
- Orden: terreno > coordinacion > SMS > medios
- Cada senal: tipo, texto resumido, timestamp, rol emisor
- SIN conteos, SIN acciones
- Solo para comprension

### 7. OperatingActorsModal.tsx (CREAR)
Modal para chip "Actores operando":
- Lista de actores con estado "operating"
- Nombre organizacion
- Tipo (ONG/Estado/Privado/Voluntariado)
- Sector(es) donde opera
- Capacidad que aporta
- Ultima confirmacion
- Contacto (nombre + telefono/email)
- CTAs: "Contactar actor", "Ver gap asociado"
- Copy fijo: "La presencia de actores no implica brechas contenidas."

### 8. MonitoredSectors.tsx (ELIMINAR)
Spec indica: "No deben aparecer gaps en evaluacion"

### 9. GapDetailDrawer.tsx (MODIFICAR)
Renombrar a SectorDetailDrawer o crear variante para vista de contexto extendido (la que ven las ONG)

---

## Archivos a Crear

```text
src/components/dashboard/
  FilterChips.tsx          <- Reemplaza GapMetrics
  SectorGapList.tsx        <- Reemplaza ImmediateAttention  
  SectorCardAdmin.tsx      <- Card de sector con gaps
  GapRow.tsx               <- Fila de gap individual
  SignalsModal.tsx         <- Modal "Ver senales"
  OperatingActorsModal.tsx <- Modal actores operando
```

## Archivos a Modificar

```text
src/pages/admin/EventDashboard.tsx
  - Agregar estados para filtros activos
  - Agregar estado para modales
  - Reemplazar componentes
  - Eliminar MonitoredSectors

src/components/dashboard/EventHeader.tsx
  - Agregar ultima senal timestamp
  - Agregar confianza global

src/services/gapService.ts
  - Agregar metodo getGapsGroupedBySector()
  - Agregar metodo getOperatingActors()

src/services/mock/data.ts
  - Agregar helper getLastSignalForEvent()
  - Agregar helper getGlobalConfidence()
```

## Archivos a Eliminar

```text
src/components/dashboard/MonitoredSectors.tsx
src/components/dashboard/GapMetrics.tsx (reemplazado)
src/components/dashboard/ImmediateAttention.tsx (reemplazado)
```

---

## Logica de Filtrado

Estado en EventDashboard:
```typescript
const [activeFilters, setActiveFilters] = useState<{
  severity: ('critical' | 'partial')[];
}>({ severity: [] });
```

Comportamiento:
- Click en chip "X Gaps" -> filtra solo sectores con gaps X y solo esos gaps
- Click en chip "Y Gaps" -> idem para Y
- Filtros combinables
- "Limpiar filtros" resetea a mostrar todos

---

## Estructura de Datos para Agrupacion

```typescript
interface SectorWithGaps {
  sector: Sector;
  context: SectorContext;
  gaps: GapWithDetails[];
  hasCritical: boolean;
  gapCounts: { critical: number; partial: number };
}
```

Ordenamiento:
1. Sectores con gaps X primero
2. Por cantidad de gaps X
3. Sectores solo Y despues
4. Gaps dentro del sector: X arriba, Y abajo

---

## Copy Cerrado para Tipos de Senal

```typescript
const SIGNAL_TYPE_COPY: Record<SignalType, string> = {
  field_report: "Reportado por actores en terreno",
  actor_report: "Validado por coordinacion territorial", 
  sms: "Basado en reportes ciudadanos (SMS)",
  news: "Detectado en contexto informativo (medios)",
  context: "Contexto inicial del evento",
  official: "Fuente oficial",
  social: "Redes sociales",
};
```

Para gap row, mostrar tipo(s) dominante(s) separados por "y" o coma.

---

## Flujo de Usuario

1. Admin abre dashboard
2. Ve header con evento, fase, ultima senal, confianza
3. Ve chips de filtro con contadores
4. Ve lista de sectores ordenados por severidad
5. Cada sector muestra contexto y gaps directamente
6. Click en "Ver senales" -> modal con evidencia
7. Click en "Activar actores de X" -> drawer con actores disponibles
8. Click en "Ver detalles" -> drawer con contexto extendido (vista ONG)
9. Click en chip "Actores operando" -> modal con lista de actores

---

## Criterio de Exito

El dashboard esta bien si un admin puede:
- Identificar el sector prioritario en 5-10 segundos
- Ver directamente los gaps relevantes
- Activar actores sin leer texto largo
- Profundizar solo si lo necesita
- Filtrar sin perder contexto

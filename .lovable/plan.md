

# Rediseno del Header y Filtros del Dashboard Admin

## Cambios en EventHeader

1. **Eliminar** el label "Unstable" (phase badge)
2. **Eliminar** el badge "Ultima senal hace..."
3. **Eliminar** el badge "Confidence Alta/Media/Baja"
4. **Eliminar** la region/location despues del nombre del evento (el "-- {event.location}")
5. **Integrar el event switcher como flecha junto al nombre**: El nombre del evento sera un DropdownMenuTrigger con un ChevronDown al lado, en lugar de un boton separado. Al clickear se despliega la lista de otros eventos.

Resultado visual del header:

```text
Incendio Valparaiso  v
```

Solo el nombre del evento con una flecha dropdown al lado.

## Cambios en SectorCardAdmin - Label de alerta del sector

Actualmente muestra contadores separados de gaps criticos/parciales (ej: "2 criticas, 1 parcial"). Se reemplazara por **un unico badge de estado del sector** con color semantico:

| Estado | Color | Condicion |
|--------|-------|-----------|
| Critico | Rojo (`gap-critical`) | Al menos 1 gap critico |
| Parcial | Naranja (`warning`) | Solo gaps parciales |
| Activo | Amarillo | Solo gaps en estado "active" |
| Contenido | Verde (`coverage`) | Sin gaps |

Se mostrara como un badge pequeno junto al nombre del sector (ej: un circulo o pill con el color correspondiente y texto "Critico"/"Parcial"/"Activo"/"Contenido").

## Cambios en FilterChips

1. **"3 sectors with gaps"** - Cambiar de Badge clickeable a texto plano informativo (sin hover, sin cursor pointer, sin apariencia de boton). Solo un span con icono.

2. **"Organizations operating"** - Mover a la derecha con `ml-auto` y cambiar de Badge a un Button con variant `outline` y un icono de Activity, para diferenciarlo visualmente de los filtros.

3. **Filtros por estado de sector**: Los filtros actuales (critical/partial) filtraran por el estado general del sector, no por gap individual. Se mantienen "critical" y "partial" como opciones.

4. **Filtro por capacidad**: Agregar un dropdown/select que permita filtrar por tipo de capacidad (ej: "Water", "Shelter", "Health"). Se extraera la lista de capacity types de los datos cargados. El SectorGapList recibira este filtro adicional.

## Detalle tecnico

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/dashboard/EventHeader.tsx` | Simplificar: solo nombre + dropdown flecha. Eliminar phase, last signal, confidence, location |
| `src/components/dashboard/SectorCardAdmin.tsx` | Reemplazar contadores critico/parcial por un unico badge de estado del sector con color |
| `src/components/dashboard/FilterChips.tsx` | (1) "sectors with gaps" como texto no-boton, (2) "organizations operating" como Button a la derecha, (3) agregar filtro por capacidad |
| `src/components/dashboard/SectorGapList.tsx` | Aceptar filtro de capacidad adicional y aplicarlo |
| `src/pages/admin/EventDashboard.tsx` | Pasar estado de filtro de capacidad, eliminar props innecesarios del header |

### EventHeader simplificado

```tsx
<div className="flex items-center gap-1">
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button className="flex items-center gap-2 text-2xl font-bold tracking-tight hover:text-primary transition-colors">
        {event.name}
        <ChevronDown className="w-5 h-5 text-muted-foreground" />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent>
      {otherEvents.map(e => (
        <DropdownMenuItem key={e.id} onClick={() => onEventChange(e.id)}>
          {e.name}
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
</div>
```

### FilterChips reestructurado

```text
[3 sectors with gaps]  [Critical]  [Partial]  [Capacidad v]  ────────  [Organizations operating →]
  texto plano          filtro       filtro     dropdown          espacio    boton outline
```

### SectorCardAdmin badge unico

```text
┌─────────────────────────────────────────┐
│ Sector Norte  ● Critico    [Ver detalles]│
│ • Punto contexto 1                       │
│ Faltantes:                               │
│   ⚠ Water        [👁] [👥]              │
│   ⚠ Shelter      [👁] [👥]              │
└─────────────────────────────────────────┘
```

El circulo/badge de estado sera un unico indicador con el color mas severo del sector.


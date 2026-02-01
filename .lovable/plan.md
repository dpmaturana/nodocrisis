
# Plan: Corregir Posicionamiento de Cards Bajo el Mapa Sticky

## Problema

En la captura se observan dos issues:
1. **Card anterior visible**: El contenido de la card anterior ("Alimentación — No coverage") aparece visible arriba del mapa cuando está en modo sticky
2. **Card cortada**: Al hacer scroll, las cards quedan parcialmente ocultas detrás del mapa en lugar de aparecer completas justo debajo

## Causa Raíz

El contenedor sticky del mapa solo envuelve el mapa + spacer, pero no tiene un fondo sólido que oculte el contenido que pasa por debajo. Además, el spacer `h-6` está dentro del sticky container pero no actúa como "ocultador" visual.

## Solución

### 1. Modificar `MapView.tsx` - Agregar fondo sólido al sticky container

El contenedor sticky necesita un fondo que oculte cualquier contenido que scrollee por debajo:

```tsx
// Antes
<div className="sticky top-14 z-10">

// Después  
<div className="sticky top-14 z-10 bg-background">
```

### 2. Ajustar el cálculo de scroll en `useSectorFocus.ts`

El cálculo actual no considera correctamente el spacer. Necesitamos:
- Sumar la altura del spacer (24px) al offset
- Usar la altura real del mapa calculada dinámicamente

```tsx
// Ajustes en el cálculo
const headerOffset = 56; // h-14
const mapHeight = window.innerHeight * (mapHeightVh / 100);
const spacerHeight = 24; // h-6 spacer debajo del mapa
const totalStickyHeight = headerOffset + mapHeight + spacerHeight;
```

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/map/MapView.tsx` | Agregar `bg-background` al sticky container |
| `src/hooks/useSectorFocus.ts` | Ajustar cálculo incluyendo spacer height |

## Resultado Esperado

- El contenido que scrollea quedará completamente oculto detrás del mapa sticky
- Las cards aparecerán justo debajo del spacer sin quedar cortadas
- No habrá contenido visible entre el header y el mapa

## Esfuerzo Estimado
Menos de 1 crédito


# Plan: Layout Side-by-Side con Mapa Fijo

## Estructura Visual Deseada

```text
┌──────────────────────────────────────────────────────────┐
│ MENU SUPERIOR (56px)                                     │
├──────────────────────────────────────────────────────────┤
│ EVENT HEADER (ancho completo)                            │
├──────────────────────────────────────────────────────────┤
│ FILTER CHIPS (ancho completo)                            │
├─────────────────┬────────────────────────────────────────┤
│                 │  ┌──────────┐  ┌──────────┐            │
│     MAPA        │  │  Card 1  │  │  Card 2  │            │
│   (cuadrado)    │  └──────────┘  └──────────┘            │
│                 │  ┌──────────┐  ┌──────────┐            │
│   FIJO - no     │  │  Card 3  │  │  Card 4  │  SCROLL    │
│   desaparece    │  └──────────┘  └──────────┘            │
│   al scroll     │  ┌──────────┐  ┌──────────┐            │
│                 │  │  Card 5  │  │  Card 6  │            │
└─────────────────┴────────────────────────────────────────┘
```

## Cambios en EventDashboard.tsx

Reestructurar el layout:

```tsx
<div className="h-[calc(100vh-56px)] flex flex-col">
  {/* Header + Filtros - ancho completo, altura fija */}
  <div className="shrink-0 p-4 pb-0 space-y-4">
    <EventHeader ... />
    <FilterChips ... />
  </div>
  
  {/* Contenedor side-by-side */}
  <div className="flex-1 flex gap-4 p-4 min-h-0">
    {/* Mapa fijo izquierda - cuadrado, sticky */}
    <aside className="w-[320px] shrink-0 self-start sticky top-0">
      <MapView variant="sidebar" ... />
    </aside>
    
    {/* Panel derecho - scroll independiente */}
    <main className="flex-1 overflow-y-auto min-h-0">
      <SectorGapList gridColumns={2} ... />
    </main>
  </div>
</div>
```

## Cambios Clave

| Elemento | Comportamiento |
|----------|----------------|
| Header + Filtros | Fijo arriba, ancho completo |
| Mapa | Cuadrado ~320px, sticky a la izquierda, no scrollea |
| Tarjetas | Grid 2 columnas, scroll independiente en el panel derecho |

## Ajustes en useSectorFocus.ts

Modificar para hacer scroll dentro del contenedor `main` en lugar de la ventana completa:

```tsx
const scrollToCard = useCallback((sectorId: string) => {
  const container = document.querySelector(containerSelector);
  const card = document.getElementById(`sector-${sectorId}`);
  if (!container || !card) return;
  
  // Scroll dentro del contenedor, no la ventana
  const containerRect = container.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  const scrollTop = container.scrollTop + cardRect.top - containerRect.top - 16;
  
  container.scrollTo({ top: scrollTop, behavior: "smooth" });
  // ... highlight logic
}, [containerSelector]);
```

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/admin/EventDashboard.tsx` | Reestructurar a layout flex con mapa sticky izquierdo |
| `src/hooks/useSectorFocus.ts` | Scroll dentro de contenedor especifico en lugar de window |

## Resultado Esperado

- Header y filtros siempre visibles arriba
- Mapa cuadrado fijo a la izquierda (nunca desaparece)
- Tarjetas en 2 columnas a la derecha con scroll independiente
- Click en pin del mapa hace scroll a la tarjeta y la destaca

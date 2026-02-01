
# Plan: Refactor Estructural del Dashboard Admin

## Objetivo

Transformar el dashboard de un layout con sidebar lateral a un layout optimizado para densidad operativa con:
- Menu superior fijo (navegacion pura)
- Mapa lateral izquierdo (fijo, cuadrado)
- Cards de sectores compactas (4+ visibles por viewport)

## Arquitectura Actual vs Nueva

```text
ANTES:                              DESPUES:
┌──────┬──────────────────┐        ┌──────────────────────────────┐
│      │                  │        │ MENU SUPERIOR (56px)          │
│      │                  │        ├─────────────┬────────────────┤
│ SIDE │    CONTENIDO     │   →    │   MAPA      │  SECTOR CARDS  │
│ BAR  │    (mapa arriba, │        │ (280-320px) │  (scroll)      │
│      │     cards abajo) │        │  cuadrado   │  ≥4 visibles   │
│      │                  │        │   fijo      │                │
└──────┴──────────────────┘        └─────────────┴────────────────┘
```

## Cambios por Archivo

### 1. Nuevo Componente: `src/components/layout/AdminTopNav.tsx`

Menu horizontal superior reemplazando el sidebar.

**Contenido:**
- Logo/NodoCrisis (izquierda)
- Links de navegacion: Dashboard, New Emergency, Red de Actores, Eventos Pasados
- Perfil/Logout (derecha)

**Reglas visuales:**
- Altura: 56px (h-14)
- Bajo contraste (no competir con cards)
- Sin badges, sin metricas, sin estados

### 2. Modificar: `src/components/layout/AppLayout.tsx`

Eliminar uso de `AppSidebar` para admins. Usar nuevo `AdminTopNav` + layout sin sidebar.

```tsx
// Para admins:
<div className="min-h-screen bg-background">
  <AdminTopNav />
  <main className="pt-0">
    <Outlet />
  </main>
</div>
```

### 3. Modificar: `src/pages/admin/EventDashboard.tsx`

Nuevo layout side-by-side:

```tsx
<div className="flex gap-4 h-[calc(100vh-56px)]">
  {/* Panel izquierdo: Mapa fijo cuadrado */}
  <aside className="w-[320px] shrink-0 sticky top-0 self-start">
    <MapView ... />
  </aside>

  {/* Panel derecho: Cards scrolleables */}
  <main className="flex-1 overflow-y-auto space-y-3 pr-4">
    <EventHeader ... />
    <FilterChips ... />
    <SectorGapList ... />
  </main>
</div>
```

**Cambios en MapView:**
- Remover sticky behavior (ya no es sticky vertical)
- Cambiar dimensiones a cuadrado (aspect-square)
- Ancho fijo 280-320px

### 4. Modificar: `src/components/map/MapView.tsx`

Nuevo prop `variant` para modo lateral:

```tsx
interface MapViewProps {
  variant?: "stacked" | "sidebar"; // nuevo
  ...
}

// variant="sidebar": aspect-square, sin sticky
// variant="stacked": comportamiento actual
```

### 5. Modificar: `src/components/dashboard/SectorCardAdmin.tsx`

Reducir altura 30-40% con estos cambios:

| Elemento | Antes | Despues |
|----------|-------|---------|
| Padding | p-4/pb-3 | p-3/pb-2 |
| Titulo | text-lg | text-base font-semibold |
| Context bullets | Hasta 2 | Maximo 2, texto mas corto |
| Gap rows | Todos visibles | Max 2 mas criticos + "Ver (+N)" |
| Botones | Texto largo | Solo iconos + tooltip |

**Estructura compacta:**
```text
San Carlos Rural          🔴 Critical
• Accesos interrumpidos
• Aislamiento parcial

Faltantes: Evacuacion, Salud mental (+1)

[👁] [👥 Activar]
```

### 6. Modificar: `src/components/dashboard/GapRow.tsx`

Version compacta inline:

- Combinar multiples gaps en una linea
- CTAs con solo iconos
- Eliminar descripcion de signal types (solo visible en modal)

### 7. Actualizar: `src/hooks/useSectorFocus.ts`

Ajustar calculo de scroll para nuevo layout side-by-side (ya no hay mapa arriba ocupando 40vh).

### 8. Actualizar: `src/index.css`

Agregar variables para jerarquia visual:

```css
/* Jerarquia visual */
--nav-opacity: 0.7;      /* Menu: menor contraste */
--map-opacity: 0.85;     /* Mapa: medio */
--card-opacity: 1;       /* Cards: maximo foco */
```

## Archivos a Crear

| Archivo | Descripcion |
|---------|-------------|
| `src/components/layout/AdminTopNav.tsx` | Menu superior horizontal para admins |

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/components/layout/AppLayout.tsx` | Usar AdminTopNav en lugar de sidebar para admins |
| `src/pages/admin/EventDashboard.tsx` | Layout side-by-side (mapa izq + cards der) |
| `src/components/map/MapView.tsx` | Agregar variant="sidebar" para modo lateral |
| `src/components/dashboard/SectorCardAdmin.tsx` | Version compacta (30-40% menos altura) |
| `src/components/dashboard/GapRow.tsx` | Version inline compacta |
| `src/hooks/useSectorFocus.ts` | Ajustar scroll para nuevo layout |
| `src/index.css` | Variables de jerarquia visual |

## Resultado Visual Esperado

Viewport 1080p:
- Menu superior: 56px
- Area disponible: calc(100vh - 56px) ≈ 1024px
- Mapa: 320x320px (cuadrado)
- Cards: ~200px altura cada una → 4-5 visibles

## Jerarquia Visual

1. **Cards** (maximo contraste): Fondo solido, bordes definidos, tipografia negra
2. **Mapa** (contraste medio): Ligeramente desaturado, sin competir
3. **Menu** (minimo contraste): Fondo sutil, texto muted

## Esfuerzo Estimado

3-4 creditos (refactor estructural significativo)

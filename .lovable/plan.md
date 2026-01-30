
# Plan: Translate UI to English

## Overview

Translate all user-facing text from Spanish to English across the application. This includes:
- Page titles and descriptions
- Button labels and actions
- Form labels and placeholders
- Toast messages
- Status labels and badges
- Modal/dialog content
- Empty states and error messages

## Scope Analysis

Based on codebase exploration, the following files contain Spanish text:

### Pages (12 files)
| File | Estimated Strings |
|------|-------------------|
| `src/pages/Auth.tsx` | ~20 |
| `src/pages/Dashboard.tsx` | ~25 |
| `src/pages/Events.tsx` | ~15 |
| `src/pages/EventDetail.tsx` | ~35 |
| `src/pages/Sectors.tsx` | ~20 |
| `src/pages/MyCapabilities.tsx` | ~30 |
| `src/pages/MyDeployments.tsx` | ~15 |
| `src/pages/admin/ActorNetwork.tsx` | ~15 |
| `src/pages/admin/Coordination.tsx` | ~50 |
| `src/pages/admin/CreateEventAI.tsx` | ~25 |
| `src/pages/admin/EventDashboard.tsx` | ~10 |
| `src/pages/admin/SituationReport.tsx` | ~40 |

### Layout Components (3 files)
| File | Estimated Strings |
|------|-------------------|
| `src/components/layout/AppSidebar.tsx` | ~15 |
| `src/components/layout/ActorHeader.tsx` | ~5 |
| `src/components/layout/ActorLayout.tsx` | ~5 |

### Feature Components (~20 files)
| Category | Files | Estimated Strings |
|----------|-------|-------------------|
| Sectors | 3 files | ~40 |
| Deployments | 4 files | ~45 |
| Actors | 8 files | ~60 |
| Dashboard | 7 files | ~50 |
| Reports | 3 files | ~25 |

### Other Files
| File | Estimated Strings |
|------|-------------------|
| `src/services/mock/data.ts` | ~20 (capacity type descriptions) |
| `src/types/database.ts` | ~15 (label constants) |
| `src/hooks/use-toast.ts` | ~5 |

## Translation Mapping (Key Examples)

### Navigation and Headers
| Spanish | English |
|---------|---------|
| Dashboard | Dashboard |
| Eventos | Events |
| Sectores | Sectors |
| Mis Capacidades | My Capabilities |
| Mis Despliegues | My Deployments |
| Red de Actores | Actor Network |
| Coordinación | Coordination |
| Nueva Emergencia | New Emergency |
| Configuración | Settings |
| Cerrar sesión | Sign Out |

### Actions and Buttons
| Spanish | English |
|---------|---------|
| Agregar | Add |
| Guardar | Save |
| Cancelar | Cancel |
| Confirmar | Confirm |
| Crear | Create |
| Editar | Edit |
| Eliminar | Delete |
| Descartar | Discard |
| Inscribirme | Enroll |
| Ver detalles | View details |
| Buscar | Search |

### Status Labels
| Spanish | English |
|---------|---------|
| Activo | Active |
| Cerrado | Closed |
| Crítico | Critical |
| Parcial | Partial |
| Contenido | Contained |
| Disponible | Available |
| Limitada | Limited |
| No disponible | Unavailable |
| Operando | Operating |
| Confirmado | Confirmed |
| Finalizado | Finished |

### Form Labels
| Spanish | English |
|---------|---------|
| Nombre | Name |
| Correo electrónico | Email |
| Contraseña | Password |
| Organización | Organization |
| Descripción | Description |
| Cantidad | Quantity |
| Unidad | Unit |
| Disponibilidad | Availability |
| Notas | Notes |

### Toast Messages
| Spanish | English |
|---------|---------|
| Capacidad agregada | Capability added |
| Error al guardar | Error saving |
| Inscripción exitosa | Enrollment successful |
| Operación finalizada | Operation finished |
| Borrador guardado | Draft saved |

## Implementation Order

### Batch 1: Core Pages (4-5 credits)
1. `src/pages/Auth.tsx`
2. `src/pages/Dashboard.tsx`
3. `src/pages/Events.tsx`
4. `src/pages/Sectors.tsx`
5. `src/pages/MyCapabilities.tsx`
6. `src/pages/MyDeployments.tsx`

### Batch 2: Admin Pages (2-3 credits)
1. `src/pages/admin/ActorNetwork.tsx`
2. `src/pages/admin/Coordination.tsx`
3. `src/pages/admin/CreateEventAI.tsx`
4. `src/pages/admin/SituationReport.tsx`
5. `src/pages/admin/EventDashboard.tsx`
6. `src/pages/EventDetail.tsx`

### Batch 3: Layout and Navigation (1 credit)
1. `src/components/layout/AppSidebar.tsx`
2. `src/components/layout/ActorHeader.tsx`
3. `src/components/layout/ActorLayout.tsx`

### Batch 4: Sector Components (1-2 credits)
1. `src/components/sectors/SectorCard.tsx`
2. `src/components/sectors/SectorDetailDrawer.tsx`
3. `src/components/sectors/EnrollmentModal.tsx`

### Batch 5: Deployment Components (1-2 credits)
1. `src/components/deployments/SectorDeploymentCard.tsx`
2. `src/components/deployments/CapabilityRow.tsx`
3. `src/components/deployments/FieldStatusReport.tsx`
4. `src/components/deployments/CompletedReportView.tsx`

### Batch 6: Actor Components (1-2 credits)
1. `src/components/actors/ActorForm.tsx`
2. `src/components/actors/ActorRow.tsx`
3. `src/components/actors/ActorDetailDrawer.tsx`
4. `src/components/actors/ActorListFilters.tsx`
5. `src/components/actors/CapabilityDeclaredList.tsx`
6. `src/components/actors/HabitualZonesList.tsx`
7. Other actor components

### Batch 7: Dashboard and Report Components (1 credit)
1. `src/components/dashboard/SectorCardAdmin.tsx`
2. `src/components/dashboard/GapRow.tsx`
3. `src/components/dashboard/FilterChips.tsx`
4. `src/components/reports/SuggestedSectorCard.tsx`
5. `src/components/reports/CapabilityToggleList.tsx`

### Batch 8: Data and Types (1 credit)
1. `src/services/mock/data.ts` (capacity type names/descriptions)
2. `src/types/database.ts` (label constants like `ACTOR_TYPE_LABELS`)

## Special Considerations

### Date Formatting
Replace Spanish locale imports:
```typescript
// Before
import { es } from "date-fns/locale";
format(date, "d MMM yyyy", { locale: es })

// After
format(date, "d MMM yyyy")  // Uses default English
```

### Branding
Keep the app name **"NodoCrisis"** unchanged - it's a proper noun/brand name.

### Capacity Types
These are currently hardcoded in Spanish in `src/services/mock/data.ts`. They need translation:
- "Evacuacion y traslado" -> "Evacuation and transport"
- "Busqueda y rescate" -> "Search and rescue"
- "Atencion medica de emergencia" -> "Emergency medical care"
- etc.

### Type Constants
Update label mappings in `src/types/database.ts`:
```typescript
// Before
export const ACTOR_TYPE_LABELS: Record<ActorType, string> = {
  ong: "ONG",
  government: "Gobierno",
  private: "Empresa Privada",
  // ...
};

// After
export const ACTOR_TYPE_LABELS: Record<ActorType, string> = {
  ong: "NGO",
  government: "Government",
  private: "Private Company",
  // ...
};
```

## Estimated Effort

| Batch | Files | Credits |
|-------|-------|---------|
| 1 - Core Pages | 6 | 2-3 |
| 2 - Admin Pages | 6 | 2-3 |
| 3 - Layout | 3 | 1 |
| 4 - Sectors | 3 | 1 |
| 5 - Deployments | 4 | 1-2 |
| 6 - Actors | 7+ | 1-2 |
| 7 - Dashboard/Reports | 5 | 1 |
| 8 - Data/Types | 2 | 1 |
| **Total** | **~36** | **~10-14** |

## Technical Notes

- No i18n library needed - direct string replacement
- Parallel file edits will be used within each batch for efficiency
- All file edits use `lov-line-replace` for precision
- Testing after each batch recommended to catch any missed strings

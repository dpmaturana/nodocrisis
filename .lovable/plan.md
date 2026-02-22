

## Translate All Remaining Spanish UI Text to English

### Files and Changes

**1. `src/lib/needStatus.ts` -- Status labels to English criticality terms**

| Status | Current label | New label | Current shortLabel | New shortLabel |
|--------|--------------|-----------|-------------------|---------------|
| WHITE | Monitoreo | Monitoring | Blanco | Monitoring |
| RED | Critico sin cobertura | Critical | Rojo | Critical |
| ORANGE | Cobertura insuficiente | Insufficient | Naranja | Insufficient |
| YELLOW | Cobertura en validacion | Under review | Amarillo | Under review |
| GREEN | Estabilizado | Stabilized | Verde | Stabilized |

**2. `src/types/activityLog.ts` -- Source type labels**

| Key | Current | New |
|-----|---------|-----|
| ngo | ONG | NGO |
| original_context | Contexto Original | Original Context |
| system | Sistema | System |

**3. `src/components/layout/AdminTopNav.tsx` -- Nav and dropdown**

| Current | New |
|---------|-----|
| Red de Actores | Actor Network |
| Eventos Pasados | Past Events |
| Usuario (fallback) | User |
| Perfil | Profile |
| Cerrar sesion | Sign out |

**4. `src/components/layout/AppSidebar.tsx` -- Sidebar nav labels**

| Current | New |
|---------|-----|
| Red de Actores | Actor Network |
| Eventos Pasados | Past Events |
| Configuracion | Settings |
| Eventos | Events |
| Sectores | Sectors |
| Mis Capacidades | My Capabilities |
| Mis Despliegues | My Deployments |
| Usuario (fallback) | User |
| Administrador | Admin |

**5. `src/components/dashboard/FilterChips.tsx` -- Dashboard filter bar**

| Current | New |
|---------|-----|
| sectores con brechas | sectors with gaps |
| Capacidad | Capability |
| organizaciones operando | organizations operating |
| Limpiar | Clear |

**6. `src/components/deployments/SectorDeploymentCard.tsx` -- Actor deployment view**

| Current | New |
|---------|-----|
| Tus capacidades | Your capabilities |
| Operacion iniciada! | Operation started! |
| Tus capacidades ahora estan marcadas como operando | Your capabilities are now marked as operating |

**7. `src/components/actors/ActorDetailDrawer.tsx` -- Actor detail**

| Current | New |
|---------|-----|
| Capacidad eliminada | Capability removed |

### Summary

All user-facing Spanish text across navigation, dashboard filters, status labels, activity log sources, and deployment toasts will be translated to English, consistent with the project's established English-only UI language policy.


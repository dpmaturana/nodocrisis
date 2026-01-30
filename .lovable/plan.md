
## Plan: Seccion Red de Actores — Gestion Estructural de Actores (Admin)

### Objetivo
Crear una seccion administrativa para gestionar la base estructural de actores del sistema. Esta seccion NO es operativa y esta disenada para usarse fuera de emergencias.

Acciones permitidas:
- Registrar/editar actores
- Definir capacidades declaradas
- Definir zonas habituales de operacion
- Gestionar contactos
- Ver historial de participacion (solo lectura)

Acciones prohibidas:
- Activar actores en emergencias
- Asignar a sectores
- Cambiar estados operativos

---

## Estructura de Datos

### Nuevo Tipo: Actor (para la red estructural)

```typescript
// src/types/database.ts (agregar)
export type ActorType = 'ong' | 'state' | 'private' | 'volunteer';
export type ActorStructuralStatus = 'active' | 'inactive';
export type CapabilityLevel = 'basic' | 'operational' | 'specialized';

export interface Actor {
  id: string;
  user_id: string; // Link to auth user
  organization_name: string;
  organization_type: ActorType;
  description: string | null;
  structural_status: ActorStructuralStatus;
  created_at: string;
  updated_at: string;
}

export interface ActorCapabilityDeclared {
  id: string;
  actor_id: string;
  capacity_type_id: string;
  level: CapabilityLevel;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActorHabitualZone {
  id: string;
  actor_id: string;
  region: string;
  commune: string | null;
  presence_type: 'habitual' | 'occasional';
  created_at: string;
}

export interface ActorContact {
  id: string;
  actor_id: string;
  name: string;
  role: string;
  primary_channel: string; // telefono, whatsapp, radio, email
  secondary_channel: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface ActorParticipationHistory {
  event_id: string;
  event_name: string;
  capacities_activated: string[];
  sectors_operated: string[];
  started_at: string;
  ended_at: string | null;
}
```

---

## Archivos a Crear

```text
src/pages/admin/
  ActorNetwork.tsx           <- Vista principal: listado de actores

src/components/actors/
  ActorListFilters.tsx       <- Barra de busqueda + filtros
  ActorRow.tsx               <- Fila de actor en listado
  ActorDetailDrawer.tsx      <- Ficha completa de actor (drawer)
  ActorForm.tsx              <- Formulario para crear/editar actor
  CapabilityDeclaredList.tsx <- Lista de capacidades declaradas
  HabitualZonesList.tsx      <- Lista de zonas habituales
  ContactsList.tsx           <- Lista de contactos (max 2)
  ParticipationHistory.tsx   <- Historial de participacion (solo lectura)

src/services/
  actorNetworkService.ts     <- Servicio para gestion de actores
```

---

## Componentes en Detalle

### 1. ActorNetwork.tsx (Pagina Principal)
Vista de listado simple, sin urgencia ni alarmas.

Estructura:
- Header: "Red de Actores" + descripcion + CTA "Registrar Actor"
- Barra de busqueda por nombre
- Filtros: Capacidad | Zona | Tipo de actor
- Lista de ActorRow

```text
+------------------------------------+
| Red de Actores                     |
| Gestion estructural de capacidades |
|                    [Registrar Actor]|
+------------------------------------+
| [Buscar...]                        |
| Filtros: [Capacidad] [Zona] [Tipo] |
+------------------------------------+
| ActorRow: Cruz Roja Chile          |
| ActorRow: Bomberos Voluntarios     |
| ActorRow: ONEMI Regional           |
+------------------------------------+
```

### 2. ActorRow.tsx
Fila de actor en el listado.

Mostrar:
- Nombre de organizacion
- Tipo (ONG / Estado / Voluntariado / Privado) - Badge
- Capacidades principales (max 3)
- Zonas habituales (resumen)
- Estado estructural: Activo / Inactivo - Badge
- CTA: "Ver ficha"

NO mostrar: estados operativos, urgencia, colores de severidad

```text
+--------------------------------------------+
| [Icon] Cruz Roja Chile          [ONG Badge]|
|        Transporte, Salud, Alimentacion     |
|        Nuble, Bio Bio              [Activo]|
|                             [Ver ficha ->] |
+--------------------------------------------+
```

### 3. ActorDetailDrawer.tsx (Ficha de Actor)
Drawer lateral con toda la informacion del actor.

Secciones:
1. **Identidad** - Nombre, tipo, descripcion
2. **Capacidades Declaradas** - Lista editable con nivel
3. **Zonas Habituales** - Regiones/comunas + tipo presencia
4. **Contactos** - Max 2 contactos con nombre, rol, canales
5. **Historial de Participacion** - Solo lectura

CTAs permitidos:
- Editar informacion
- Activar/Desactivar actor (estructural)
- Agregar/editar capacidad
- Agregar/editar contacto

### 4. ActorForm.tsx
Modal para crear/editar actor.

Campos:
- Nombre de organizacion (requerido)
- Tipo de actor (select: ONG/Estado/Privado/Voluntariado)
- Descripcion breve (textarea, max 200 caracteres)
- Estado estructural (toggle: Activo/Inactivo)

### 5. CapabilityDeclaredList.tsx
Lista de capacidades declaradas por el actor.

Para cada capacidad:
- Tipo (select de taxonomia comun)
- Nivel: Basico / Operativo / Especializado
- Observaciones (opcional)

Taxonomia cerrada:
- Transporte
- Agua
- Alimentacion
- Salud
- Busqueda y Rescate
- Alojamiento
- Comunicaciones
- Otros (requiere validacion)

### 6. ContactsList.tsx
Lista de contactos (max 2).

Validacion:
- Maximo 2 contactos activos
- Contacto operativo principal (obligatorio)
- Contacto alternativo (opcional)

Campos por contacto:
- Nombre
- Rol (ej: "Coordinador logistico")
- Canal principal (telefono/WhatsApp/radio/email)
- Canal secundario (opcional)

### 7. ParticipationHistory.tsx
Historial de eventos pasados (solo lectura).

Para cada evento:
- Nombre del evento
- Capacidades activadas
- Sectores donde opero
- Fechas

Este historial es informativo, no evaluativo.

---

## Servicio: actorNetworkService.ts

```typescript
export const actorNetworkService = {
  // Listado
  getAll(): Promise<ActorWithDetails[]>
  getById(actorId: string): Promise<ActorWithDetails | null>
  
  // Filtros
  search(query: string): Promise<ActorWithDetails[]>
  filterByCapacity(capacityTypeId: string): Promise<ActorWithDetails[]>
  filterByZone(region: string): Promise<ActorWithDetails[]>
  filterByType(type: ActorType): Promise<ActorWithDetails[]>
  
  // CRUD Actor
  create(actor: CreateActorInput): Promise<Actor>
  update(actorId: string, data: UpdateActorInput): Promise<Actor>
  setStatus(actorId: string, status: ActorStructuralStatus): Promise<void>
  
  // Capacidades
  addCapability(actorId: string, capability: CreateCapabilityInput): Promise<ActorCapabilityDeclared>
  updateCapability(capabilityId: string, data: UpdateCapabilityInput): Promise<void>
  removeCapability(capabilityId: string): Promise<void>
  
  // Zonas
  addZone(actorId: string, zone: CreateZoneInput): Promise<ActorHabitualZone>
  removeZone(zoneId: string): Promise<void>
  
  // Contactos
  setContacts(actorId: string, contacts: ContactInput[]): Promise<void>
  
  // Historial (solo lectura)
  getParticipationHistory(actorId: string): Promise<ActorParticipationHistory[]>
}

interface ActorWithDetails {
  actor: Actor;
  capabilities: ActorCapabilityDeclared[];
  zones: ActorHabitualZone[];
  contacts: ActorContact[];
  capacityTypes: CapacityType[]; // Resolved names
}
```

---

## Mock Data (Inicial)

```typescript
// src/services/mock/data.ts (agregar)
export const MOCK_ACTORS_NETWORK: Actor[] = [
  {
    id: "actor-net-1",
    user_id: "mock-actor-1",
    organization_name: "Cruz Roja Chile",
    organization_type: "ong",
    description: "Organizacion humanitaria con presencia nacional",
    structural_status: "active",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-15T00:00:00Z",
  },
  {
    id: "actor-net-2",
    user_id: "mock-admin-1",
    organization_name: "Bomberos Voluntarios Chillan",
    organization_type: "volunteer",
    description: "Cuerpo de bomberos con capacidad de rescate",
    structural_status: "active",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-10T00:00:00Z",
  },
  {
    id: "actor-net-3",
    user_id: "mock-state-1",
    organization_name: "ONEMI Regional Nuble",
    organization_type: "state",
    description: "Oficina Nacional de Emergencias - Region de Nuble",
    structural_status: "active",
    created_at: "2024-12-01T00:00:00Z",
    updated_at: "2025-01-05T00:00:00Z",
  },
];

export const MOCK_ACTOR_CAPABILITIES_DECLARED: ActorCapabilityDeclared[] = [
  { id: "acd-1", actor_id: "actor-net-1", capacity_type_id: "cap-2", level: "specialized", notes: "Flota de 15 vehiculos 4x4" },
  { id: "acd-2", actor_id: "actor-net-1", capacity_type_id: "cap-3", level: "operational", notes: "Ambulancia basica" },
  { id: "acd-3", actor_id: "actor-net-1", capacity_type_id: "cap-5", level: "specialized", notes: "Cocina movil" },
  // ...
];

export const MOCK_ACTOR_ZONES: ActorHabitualZone[] = [
  { id: "zone-1", actor_id: "actor-net-1", region: "Nuble", commune: null, presence_type: "habitual" },
  { id: "zone-2", actor_id: "actor-net-1", region: "Bio Bio", commune: "Concepcion", presence_type: "occasional" },
  // ...
];

export const MOCK_ACTOR_CONTACTS: ActorContact[] = [
  { id: "contact-1", actor_id: "actor-net-1", name: "Maria Gonzalez", role: "Coordinadora Emergencias", primary_channel: "+56 9 1234 5678", secondary_channel: "mgonzalez@cruzroja.cl", is_primary: true, created_at: "", updated_at: "" },
  // ...
];
```

---

## Ruta en App.tsx

```typescript
// Agregar ruta para /admin/actors
<Route path="/admin/actors" element={<ActorNetwork />} />
```

---

## Diseno Visual (Sin Urgencia)

Principios:
- Colores neutros (sin rojos/naranjas de severidad)
- Layout simple de listado
- Sin metricas en tiempo real
- Sin badges de alertas
- Badges de tipo: neutros (outline/secondary)
- Badge de estado: Activo (verde suave) / Inactivo (gris)

---

## Interaccion con Dashboard

Cuando desde el Dashboard se ejecuta "Activar actores de {capacidad}":

El sistema consulta la Red de Actores y filtra por:
1. capacidad declarada (match con la brecha)
2. zona habitual compatible (match con el sector)
3. estado estructural = "active"

Esto ya funciona parcialmente con `AvailableActorsDrawer`. 
Se mejorara para consultar la nueva estructura de datos.

---

## Criterio de Exito

La seccion esta bien construida si:
- Puede mantenerse fuera de una emergencia
- No genera urgencia ni ansiedad
- Mejora la calidad del flujo "Activar actores"
- No permite acciones operativas fuera de contexto
- Un admin no entra aqui durante una crisis para "ver que hacer"

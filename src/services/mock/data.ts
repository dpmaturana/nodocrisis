import type { 
  CapacityType, 
  Sector, 
  Event, 
  Deployment, 
  ActorCapability,
  DeploymentStatus,
  AvailabilityStatus,
} from "@/types/database";

// ============== CAPACITY TYPES ==============
export const MOCK_CAPACITY_TYPES: CapacityType[] = [
  { id: "cap-1", name: "Agua y Bomberos", icon: "droplet", description: "Recursos hídricos y combate de incendios", created_at: new Date().toISOString() },
  { id: "cap-2", name: "Transporte", icon: "truck", description: "Vehículos y logística de movilización", created_at: new Date().toISOString() },
  { id: "cap-3", name: "Salud", icon: "heart", description: "Atención médica y ambulancias", created_at: new Date().toISOString() },
  { id: "cap-4", name: "Albergue", icon: "home", description: "Refugio temporal para afectados", created_at: new Date().toISOString() },
  { id: "cap-5", name: "Alimentación", icon: "utensils", description: "Provisión de alimentos y agua potable", created_at: new Date().toISOString() },
  { id: "cap-6", name: "Maquinaria Pesada", icon: "cog", description: "Retroexcavadoras, grúas y equipos pesados", created_at: new Date().toISOString() },
  { id: "cap-7", name: "Comunicaciones", icon: "radio", description: "Equipos de radio y telecomunicaciones", created_at: new Date().toISOString() },
  { id: "cap-8", name: "Búsqueda y Rescate", icon: "search", description: "Equipos especializados SAR", created_at: new Date().toISOString() },
];

// ============== EVENTS ==============
export const MOCK_EVENTS: Event[] = [
  {
    id: "evt-mock-1",
    name: "Incendios Forestales Ñuble 2026",
    type: "incendio_forestal",
    status: "active",
    location: "Región de Ñuble",
    description: "Incendios forestales activos en múltiples comunas de la región de Ñuble",
    started_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
    created_by: null,
    ended_at: null,
  },
  {
    id: "evt-mock-2",
    name: "Temporal Región Metropolitana",
    type: "temporal",
    status: "active",
    location: "Región Metropolitana",
    description: "Sistema frontal con fuertes lluvias y vientos",
    started_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
    created_by: null,
    ended_at: null,
  },
  {
    id: "evt-mock-3",
    name: "Inundación Valdivia 2025",
    type: "inundacion",
    status: "closed",
    location: "Valdivia, Los Ríos",
    description: "Evento cerrado - desborde de ríos en zona urbana",
    started_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    created_by: null,
    ended_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export const MOCK_ACTIVE_EVENT = MOCK_EVENTS[0];

// ============== SECTORS ==============
export const MOCK_SECTORS: Sector[] = [
  { 
    id: "sec-1", 
    canonical_name: "San Carlos Rural", 
    status: "unresolved", 
    event_id: "evt-mock-1",
    confidence: 0.85,
    source: "ai_suggested",
    aliases: ["San Carlos", "SC Rural"],
    latitude: -36.4241,
    longitude: -71.9569,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  { 
    id: "sec-2", 
    canonical_name: "Chillán Viejo Periurbano", 
    status: "tentative", 
    event_id: "evt-mock-1",
    confidence: 0.72,
    source: "ai_suggested",
    aliases: ["Chillán Viejo", "CV Periurbano"],
    latitude: -36.6320,
    longitude: -72.1257,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  { 
    id: "sec-3", 
    canonical_name: "Coihueco Centro", 
    status: "resolved", 
    event_id: "evt-mock-1",
    confidence: 0.91,
    source: "ai_suggested",
    aliases: ["Coihueco"],
    latitude: -36.6267,
    longitude: -71.8333,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  { 
    id: "sec-4", 
    canonical_name: "Ñiquén Norte", 
    status: "unresolved", 
    event_id: "evt-mock-1",
    confidence: 0.78,
    source: "manual",
    aliases: ["Ñiquén"],
    latitude: -36.2933,
    longitude: -71.9000,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  // Event 2 sectors
  { 
    id: "sec-5", 
    canonical_name: "Maipú Sur", 
    status: "unresolved", 
    event_id: "evt-mock-2",
    confidence: 0.80,
    source: "manual",
    aliases: ["Maipú"],
    latitude: -33.5167,
    longitude: -70.7500,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  { 
    id: "sec-6", 
    canonical_name: "Pudahuel Poniente", 
    status: "tentative", 
    event_id: "evt-mock-2",
    confidence: 0.65,
    source: "ai_suggested",
    aliases: ["Pudahuel"],
    latitude: -33.4333,
    longitude: -70.7500,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// ============== NEED LEVEL MATRIX ==============
export type NeedLevelExtended = "unknown" | "low" | "medium" | "high" | "critical" | "covered";

export const MOCK_SECTOR_CAPABILITY_MATRIX: Record<string, Record<string, NeedLevelExtended>> = {
  "sec-1": { 
    "cap-1": "critical", 
    "cap-2": "high", 
    "cap-3": "unknown", 
    "cap-4": "medium",
    "cap-5": "low",
    "cap-6": "high",
    "cap-7": "unknown",
    "cap-8": "critical",
  },
  "sec-2": { 
    "cap-1": "medium", 
    "cap-2": "low", 
    "cap-3": "high",
    "cap-4": "unknown",
    "cap-5": "medium",
    "cap-6": "unknown",
    "cap-7": "low",
    "cap-8": "medium",
  },
  "sec-3": { 
    "cap-1": "covered", 
    "cap-2": "covered", 
    "cap-3": "medium",
    "cap-4": "low",
    "cap-5": "covered",
    "cap-6": "unknown",
    "cap-7": "covered",
    "cap-8": "low",
  },
  "sec-4": { 
    "cap-1": "high", 
    "cap-2": "medium", 
    "cap-3": "critical",
    "cap-4": "high",
    "cap-5": "high",
    "cap-6": "medium",
    "cap-7": "low",
    "cap-8": "high",
  },
  "sec-5": { 
    "cap-1": "low", 
    "cap-2": "medium", 
    "cap-3": "low",
    "cap-4": "high",
    "cap-5": "medium",
    "cap-6": "unknown",
    "cap-7": "low",
    "cap-8": "unknown",
  },
  "sec-6": { 
    "cap-1": "medium", 
    "cap-2": "high", 
    "cap-3": "medium",
    "cap-4": "critical",
    "cap-5": "high",
    "cap-6": "low",
    "cap-7": "medium",
    "cap-8": "low",
  },
};

// ============== DEPLOYMENTS ==============
export let MOCK_DEPLOYMENTS: Deployment[] = [
  {
    id: "dep-1",
    event_id: "evt-mock-1",
    sector_id: "sec-1",
    capacity_type_id: "cap-2",
    actor_id: "mock-actor-1",
    status: "active",
    notes: "2 camionetas disponibles para traslado",
    verified: true,
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "dep-2",
    event_id: "evt-mock-1",
    sector_id: "sec-3",
    capacity_type_id: "cap-5",
    actor_id: "mock-actor-1",
    status: "completed",
    notes: "Entrega de 500 raciones",
    verified: true,
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "dep-3",
    event_id: "evt-mock-1",
    sector_id: "sec-2",
    capacity_type_id: "cap-3",
    actor_id: "mock-actor-1",
    status: "planned",
    notes: "Despliegue de ambulancia programado",
    verified: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// ============== ACTOR CAPABILITIES ==============
export let MOCK_ACTOR_CAPABILITIES: ActorCapability[] = [
  {
    id: "acap-1",
    user_id: "mock-actor-1",
    capacity_type_id: "cap-2",
    quantity: 3,
    unit: "vehículos",
    availability: "ready",
    notes: "Camionetas 4x4 con capacidad de carga",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "acap-2",
    user_id: "mock-actor-1",
    capacity_type_id: "cap-3",
    quantity: 1,
    unit: "ambulancia",
    availability: "limited",
    notes: "Ambulancia básica con equipamiento",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "acap-3",
    user_id: "mock-actor-1",
    capacity_type_id: "cap-5",
    quantity: 1000,
    unit: "raciones",
    availability: "ready",
    notes: "Raciones de emergencia envasadas",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// ============== HELPER FUNCTIONS ==============
export function getEventById(id: string): Event | undefined {
  return MOCK_EVENTS.find(e => e.id === id);
}

export function getSectorsByEventId(eventId: string): Sector[] {
  return MOCK_SECTORS.filter(s => s.event_id === eventId);
}

export function getSectorById(id: string): Sector | undefined {
  return MOCK_SECTORS.find(s => s.id === id);
}

export function getCapacityTypeById(id: string): CapacityType | undefined {
  return MOCK_CAPACITY_TYPES.find(c => c.id === id);
}

export function getDeploymentsByActorId(actorId: string): Deployment[] {
  return MOCK_DEPLOYMENTS.filter(d => d.actor_id === actorId);
}

export function getDeploymentsByEventId(eventId: string): Deployment[] {
  return MOCK_DEPLOYMENTS.filter(d => d.event_id === eventId);
}

export function getCapabilitiesByActorId(actorId: string): ActorCapability[] {
  return MOCK_ACTOR_CAPABILITIES.filter(c => c.user_id === actorId);
}

// Mutators for in-memory state
export function addDeployment(deployment: Omit<Deployment, "id" | "created_at" | "updated_at">): Deployment {
  const newDeployment: Deployment = {
    ...deployment,
    id: `dep-${Date.now()}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  MOCK_DEPLOYMENTS = [...MOCK_DEPLOYMENTS, newDeployment];
  return newDeployment;
}

export function updateDeploymentStatus(id: string, status: DeploymentStatus): void {
  MOCK_DEPLOYMENTS = MOCK_DEPLOYMENTS.map(d => 
    d.id === id ? { ...d, status, updated_at: new Date().toISOString() } : d
  );
}

export function addCapability(capability: Omit<ActorCapability, "id" | "created_at" | "updated_at">): ActorCapability {
  const newCapability: ActorCapability = {
    ...capability,
    id: `acap-${Date.now()}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  MOCK_ACTOR_CAPABILITIES = [...MOCK_ACTOR_CAPABILITIES, newCapability];
  return newCapability;
}

export function deleteCapability(id: string): void {
  MOCK_ACTOR_CAPABILITIES = MOCK_ACTOR_CAPABILITIES.filter(c => c.id !== id);
}

export function updateCapabilityAvailability(id: string, availability: AvailabilityStatus): void {
  MOCK_ACTOR_CAPABILITIES = MOCK_ACTOR_CAPABILITIES.map(c => 
    c.id === id ? { ...c, availability, updated_at: new Date().toISOString() } : c
  );
}

export function addEvent(event: Omit<Event, "id" | "created_at" | "updated_at">): Event {
  const newEvent: Event = {
    ...event,
    id: `evt-${Date.now()}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  (MOCK_EVENTS as Event[]).push(newEvent);
  return newEvent;
}

export function addSector(sector: Omit<Sector, "id" | "created_at" | "updated_at">): Sector {
  const newSector: Sector = {
    ...sector,
    id: `sec-${Date.now()}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  (MOCK_SECTORS as Sector[]).push(newSector);
  // Initialize matrix for new sector
  MOCK_SECTOR_CAPABILITY_MATRIX[newSector.id] = {};
  MOCK_CAPACITY_TYPES.forEach(cap => {
    MOCK_SECTOR_CAPABILITY_MATRIX[newSector.id][cap.id] = "unknown";
  });
  return newSector;
}

export function updateMatrixCell(sectorId: string, capacityId: string, level: NeedLevelExtended): void {
  if (!MOCK_SECTOR_CAPABILITY_MATRIX[sectorId]) {
    MOCK_SECTOR_CAPABILITY_MATRIX[sectorId] = {};
  }
  MOCK_SECTOR_CAPABILITY_MATRIX[sectorId][capacityId] = level;
}

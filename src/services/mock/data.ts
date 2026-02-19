import type { 
  CapacityType, 
  Sector, 
  Event, 
  Deployment, 
  ActorCapability,
  DeploymentStatus,
  AvailabilityStatus,
  Gap,
  GapState,
  Signal,
  SignalType,
  Actor,
  ActorCapabilityDeclared,
  ActorHabitualZone,
  ActorContact,
  ActorParticipationHistory,
} from "@/types/database";

// ============== CAPACITY TYPES ==============
export const MOCK_CAPACITY_TYPES: CapacityType[] = [
  { id: "cap-1", name: "Evacuación y traslado", criticality_level: "high", icon: "move", description: "Desplazamiento seguro de personas desde zonas de riesgo hacia lugares seguros.", created_at: new Date().toISOString() },
  { id: "cap-2", name: "Búsqueda y rescate", criticality_level: "life_threatening", icon: "search", description: "Localización y asistencia de personas atrapadas, desaparecidas o aisladas.", created_at: new Date().toISOString() },
  { id: "cap-3", name: "Protección y seguridad básica", criticality_level: "high", icon: "shield", description: "Medidas para reducir riesgos inmediatos a la integridad física de las personas.", created_at: new Date().toISOString() },
  { id: "cap-4", name: "Atención médica de emergencia", criticality_level: "life_threatening", icon: "heart-pulse", description: "Atención médica inmediata a personas lesionadas o en riesgo vital.", created_at: new Date().toISOString() },
  { id: "cap-5", name: "Salud mental y apoyo psicosocial", criticality_level: "medium", icon: "brain", description: "Apoyo emocional y psicológico a personas afectadas por la emergencia.", created_at: new Date().toISOString() },
  { id: "cap-6", name: "Agua potable", criticality_level: "life_threatening", icon: "droplet", description: "Acceso a agua segura para consumo humano en cantidad suficiente.", created_at: new Date().toISOString() },
  { id: "cap-7", name: "Saneamiento e higiene", criticality_level: "high", icon: "spray-can", description: "Servicios básicos de saneamiento e higiene para prevenir riesgos sanitarios.", created_at: new Date().toISOString() },
  { id: "cap-8", name: "Alimentación", criticality_level: "high", icon: "utensils", description: "Acceso oportuno a alimentos adecuados para la población afectada.", created_at: new Date().toISOString() },
  { id: "cap-9", name: "Alojamiento / refugio", criticality_level: "high", icon: "home", description: "Soluciones temporales de alojamiento seguro y protección ambiental.", created_at: new Date().toISOString() },
  { id: "cap-10", name: "Transporte", criticality_level: "medium", icon: "truck", description: "Movilización de personas, insumos y equipos necesarios para la respuesta.", created_at: new Date().toISOString() },
  { id: "cap-11", name: "Distribución de suministros", criticality_level: "medium", icon: "package", description: "Entrega organizada de insumos esenciales a población o puntos de atención.", created_at: new Date().toISOString() },
  { id: "cap-12", name: "Almacenamiento", criticality_level: "low", icon: "warehouse", description: "Resguardo seguro y organizado de insumos y equipos durante la respuesta.", created_at: new Date().toISOString() },
  { id: "cap-13", name: "Energía", criticality_level: "high", icon: "zap", description: "Provisión o restablecimiento de energía eléctrica o combustible para operaciones críticas.", created_at: new Date().toISOString() },
  { id: "cap-14", name: "Comunicaciones", criticality_level: "medium", icon: "radio", description: "Habilitar canales operativos de comunicación entre actores y comunidades afectadas.", created_at: new Date().toISOString() },
  { id: "cap-15", name: "Catastro de información", criticality_level: "low", icon: "clipboard-list", description: "Recopilación y síntesis de información relevante para la toma de decisiones.", created_at: new Date().toISOString() },
  { id: "cap-16", name: "Control de incendios", criticality_level: "life_threatening", icon: "flame", description: "Contención y mitigación de incendios activos que amenazan a personas o entorno.", created_at: new Date().toISOString() },
  { id: "cap-17", name: "Gestión de materiales peligrosos", criticality_level: "life_threatening", icon: "alert-triangle", description: "Manejo y mitigación de riesgos asociados a sustancias peligrosas.", created_at: new Date().toISOString() },
];

// ============== EVENTS ==============
export const MOCK_EVENTS: Event[] = [
  {
    id: "evt-mock-1",
    name: "Incendios Forestales Ñuble 2026",
    population_affected: 6800,
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
    population_affected: 2400,
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
    population_affected: 1500,
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
    population_affected: 1900,
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
    population_affected: 1200,
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
    population_affected: 800,
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
    population_affected: 1600,
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
    population_affected: 700,
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
    population_affected: null,
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

// ============== GAPS (PRD-aligned) ==============
export const MOCK_GAPS: Gap[] = [
  // Critical gaps - require immediate attention
  { id: "gap-1", event_id: "evt-mock-1", sector_id: "sec-1", capacity_type_id: "cap-1", state: "critical", last_updated_at: "2026-01-21T10:30:00Z", signal_count: 5 },
  { id: "gap-2", event_id: "evt-mock-1", sector_id: "sec-1", capacity_type_id: "cap-8", state: "critical", last_updated_at: "2026-01-21T10:15:00Z", signal_count: 3 },
  { id: "gap-3", event_id: "evt-mock-1", sector_id: "sec-4", capacity_type_id: "cap-3", state: "critical", last_updated_at: "2026-01-21T09:45:00Z", signal_count: 4 },
  // Partial gaps - some coverage but insufficient
  { id: "gap-4", event_id: "evt-mock-1", sector_id: "sec-2", capacity_type_id: "cap-4", state: "partial", last_updated_at: "2026-01-21T09:00:00Z", signal_count: 2 },
  { id: "gap-5", event_id: "evt-mock-1", sector_id: "sec-4", capacity_type_id: "cap-5", state: "partial", last_updated_at: "2026-01-21T08:30:00Z", signal_count: 2 },
  // Active gaps - fully covered
  { id: "gap-6", event_id: "evt-mock-1", sector_id: "sec-3", capacity_type_id: "cap-1", state: "active", last_updated_at: "2026-01-20T16:00:00Z", signal_count: 1 },
  // Evaluating - not visible in dashboard
  { id: "gap-7", event_id: "evt-mock-1", sector_id: "sec-2", capacity_type_id: "cap-7", state: "evaluating", last_updated_at: "2026-01-21T07:00:00Z", signal_count: 1 },
];

// ============== SIGNALS ==============
export const MOCK_SIGNALS: Signal[] = [
  // Gap 1 signals (Agua y Bomberos - San Carlos Rural)
  { id: "sig-1", event_id: "evt-mock-1", sector_id: "sec-1", signal_type: "sms", level: "sector", content: "Necesitamos agua urgente, llevamos 2 días sin suministro", source: "+56912345678", confidence: 0.85, created_at: "2026-01-21T10:30:00Z" },
  { id: "sig-2", event_id: "evt-mock-1", sector_id: "sec-1", signal_type: "sms", level: "sector", content: "El fuego está muy cerca, no hay bomberos", source: "+56987654321", confidence: 0.9, created_at: "2026-01-21T10:00:00Z" },
  { id: "sig-3", event_id: "evt-mock-1", sector_id: "sec-1", signal_type: "field_report", level: "sector", content: "Sector sin acceso a agua potable. Cisternas requeridas.", source: "Equipo Terreno A", confidence: 0.95, created_at: "2026-01-21T09:30:00Z" },
  { id: "sig-4", event_id: "evt-mock-1", sector_id: "sec-1", signal_type: "context", level: "sector", content: "Zona rural aislada, infraestructura hídrica dañada por incendio anterior", source: "Reporte Situación Inicial", confidence: 1.0, created_at: "2026-01-15T08:00:00Z" },
  // Gap 3 signals (Salud - Ñiquén Norte)
  { id: "sig-7", event_id: "evt-mock-1", sector_id: "sec-4", signal_type: "sms", level: "sector", content: "Necesitamos ambulancia, hay heridos", source: "+56922222222", confidence: 0.85, created_at: "2026-01-21T09:45:00Z" },
  { id: "sig-8", event_id: "evt-mock-1", sector_id: "sec-4", signal_type: "official", level: "sector", content: "Hospital local saturado, requiere apoyo externo", source: "SEREMI Salud", confidence: 1.0, created_at: "2026-01-21T08:00:00Z" },
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

// ============== SECTOR CONTEXT (for ONG decision-making) ==============
export interface SectorContext {
  keyPoints: string[];        // Max 3 bullets for card
  extendedContext: string;    // Full text for drawer
  operationalSummary: string; // 1-line AI summary
  accessInfo?: string;
  isolationLevel?: "none" | "partial" | "total";
  estimatedAffected?: string;
}

export const MOCK_SECTOR_CONTEXT: Record<string, SectorContext> = {
  "sec-1": {
    keyPoints: ["Accesos interrumpidos", "Aislamiento parcial", "Sin agua potable"],
    extendedContext: "Sector rural con caminos cortados por derrumbes en ruta principal. Comunidad aislada parcialmente, solo acceso por camino secundario de tierra. Sin suministro de agua potable desde hace 48 horas. Evacuación activa de familias cercanas al foco de incendio.",
    operationalSummary: "Sector rural con alta presión operativa y brechas no contenidas.",
    accessInfo: "Ruta principal cortada, acceso solo por camino secundario",
    isolationLevel: "partial",
    estimatedAffected: "~500-800 personas"
  },
  "sec-2": {
    keyPoints: ["Zona periurbana", "Evacuación en curso", "Humo denso"],
    extendedContext: "Sector periurbano en las afueras de Chillán Viejo. Evacuación preventiva activa en sector norte. Visibilidad reducida por humo denso. Acceso vehicular disponible pero con restricciones.",
    operationalSummary: "Sector periurbano con evacuación activa y condiciones de visibilidad reducida.",
    accessInfo: "Acceso vehicular con restricciones por humo",
    isolationLevel: "none",
    estimatedAffected: "~200-400 personas"
  },
  "sec-3": {
    keyPoints: ["Situación controlada", "Accesos habilitados", "Recursos desplegados"],
    extendedContext: "Sector céntrico con situación estabilizada. Recursos de emergencia desplegados y operando. Accesos habilitados y sin restricciones mayores.",
    operationalSummary: "Sector con cobertura adecuada y situación bajo control.",
    accessInfo: "Accesos habilitados sin restricciones",
    isolationLevel: "none",
    estimatedAffected: "~100-200 personas"
  },
  "sec-4": {
    keyPoints: ["Hospital saturado", "Alta demanda de salud", "Heridos reportados"],
    extendedContext: "Sector con alta concentración de necesidades de salud. Hospital local reporta saturación y solicita apoyo externo. Múltiples heridos reportados en últimas horas. Acceso vehicular disponible.",
    operationalSummary: "Sector con emergencia de salud activa y sistema local saturado.",
    accessInfo: "Acceso vehicular disponible",
    isolationLevel: "none",
    estimatedAffected: "~300-500 personas"
  },
  "sec-5": {
    keyPoints: ["Inundaciones localizadas", "Familias desplazadas", "Albergues requeridos"],
    extendedContext: "Sector afectado por inundaciones localizadas producto del temporal. Varias familias desplazadas requieren albergue temporal. Calles principales anegadas en algunos puntos.",
    operationalSummary: "Sector con inundaciones activas y necesidad de albergue.",
    accessInfo: "Calles anegadas, acceso parcial",
    isolationLevel: "partial",
    estimatedAffected: "~150-300 personas"
  },
  "sec-6": {
    keyPoints: ["Cortes de luz", "Vientos fuertes", "Árboles caídos"],
    extendedContext: "Sector con múltiples cortes de suministro eléctrico. Vientos fuertes han derribado árboles bloqueando algunas calles. Requiere maquinaria para despeje.",
    operationalSummary: "Sector con daños por viento y necesidad de despeje de vías.",
    accessInfo: "Algunas calles bloqueadas por árboles",
    isolationLevel: "none",
    estimatedAffected: "~400-600 personas"
  },
};

// ============== ACTORS IN SECTOR (for drawer display) ==============
export interface ActorInSector {
  id: string;
  name: string;
  capacity: string; // Simplified to string for Supabase compatibility
  status: "operating" | "confirmed" | "interested" | "suspended" | "finished";
  notes?: string;
}

export function getActorsInSector(sectorId: string): ActorInSector[] {
  const deployments = MOCK_DEPLOYMENTS.filter(
    d => d.sector_id === sectorId && (d.status === "operating" || d.status === "confirmed")
  );
  
  // Mock actor names based on deployment
  const actorNames: Record<string, string> = {
    "mock-actor-1": "Cruz Roja Chile",
    "mock-admin-1": "Bomberos Voluntarios",
  };
  
  return deployments.map(d => {
    const capacityType = getCapacityTypeById(d.capacity_type_id);
    return {
      id: d.id,
      name: actorNames[d.actor_id] || "Organización Anónima",
      capacity: capacityType?.name || "Capacidad",
      status: d.status as "operating" | "confirmed",
      notes: d.notes,
    };
  });
}

// ============== DEPLOYMENTS (PRD-aligned states) ==============
export let MOCK_DEPLOYMENTS: Deployment[] = [
  {
    id: "dep-1",
    event_id: "evt-mock-1",
    sector_id: "sec-1",
    capacity_type_id: "cap-2",
    actor_id: "mock-actor-1",
    status: "operating",
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
    status: "finished",
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
    status: "confirmed",
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

// Returns capabilities for any user - if no specific capabilities, returns demo set
export function getCapabilitiesByActorId(actorId: string): ActorCapability[] {
  const userCapabilities = MOCK_ACTOR_CAPABILITIES.filter(c => c.user_id === actorId);
  
  // If user has no capabilities yet, return demo capabilities assigned to them
  if (userCapabilities.length === 0) {
    return getDefaultCapabilitiesForUser(actorId);
  }
  
  return userCapabilities;
}

// Creates default demo capabilities for any new user
function getDefaultCapabilitiesForUser(userId: string): ActorCapability[] {
  const now = new Date().toISOString();
  return [
    {
      id: `demo-cap-${userId}-1`,
      user_id: userId,
      capacity_type_id: "cap-2", // Transporte
      quantity: 2,
      unit: "vehículos",
      availability: "ready",
      notes: "Vehículos de demostración",
      created_at: now,
      updated_at: now,
    },
    {
      id: `demo-cap-${userId}-2`,
      user_id: userId,
      capacity_type_id: "cap-5", // Alimentación
      quantity: 500,
      unit: "raciones",
      availability: "ready",
      notes: "Raciones de emergencia demo",
      created_at: now,
      updated_at: now,
    },
  ];
}

// ============== GAP HELPERS ==============
export function getGapsByEventId(eventId: string): Gap[] {
  return MOCK_GAPS.filter(g => g.event_id === eventId);
}

export function getVisibleGaps(eventId: string): Gap[] {
  return MOCK_GAPS.filter(g => 
    g.event_id === eventId && 
    (g.state === 'critical' || g.state === 'partial')
  );
}

export function getGapById(id: string): Gap | undefined {
  return MOCK_GAPS.find(g => g.id === id);
}

export function getSignalsByGap(sectorId: string, capacityTypeId: string): Signal[] {
  return MOCK_SIGNALS.filter(s => s.sector_id === sectorId);
}

export function getSignalsBySector(sectorId: string): Signal[] {
  return MOCK_SIGNALS.filter(s => s.sector_id === sectorId);
}

export function getDeploymentsByGap(sectorId: string, capacityTypeId: string): Deployment[] {
  return MOCK_DEPLOYMENTS.filter(d => 
    d.sector_id === sectorId && 
    d.capacity_type_id === capacityTypeId
  );
}

export function getOperatingCount(eventId: string): number {
  return MOCK_DEPLOYMENTS.filter(d => 
    d.event_id === eventId && 
    d.status === 'operating'
  ).length;
}

export function countGapsByState(eventId: string): Record<GapState, number> {
  const gaps = getGapsByEventId(eventId);
  return {
    evaluating: gaps.filter(g => g.state === 'evaluating').length,
    critical: gaps.filter(g => g.state === 'critical').length,
    partial: gaps.filter(g => g.state === 'partial').length,
    active: gaps.filter(g => g.state === 'active').length,
  };
}

export function getSectorsWithGaps(eventId: string): string[] {
  const visibleGaps = getVisibleGaps(eventId);
  return [...new Set(visibleGaps.map(g => g.sector_id))];
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

export function addSignal(signal: Omit<Signal, "id" | "created_at">): Signal {
  const newSignal: Signal = {
    ...signal,
    id: `sig-${Date.now()}`,
    created_at: new Date().toISOString(),
  };
  (MOCK_SIGNALS as Signal[]).push(newSignal);
  return newSignal;
}

// ============== DASHBOARD HELPERS ==============

/**
 * Get the last reliable signal for an event
 */
export function getLastSignalForEvent(eventId: string): Signal | null {
  const eventSignals = MOCK_SIGNALS.filter(s => s.event_id === eventId);
  if (eventSignals.length === 0) return null;
  
  // Sort by created_at descending
  const sorted = [...eventSignals].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  
  return sorted[0];
}

/**
 * Get global confidence level for an event based on signal quality
 */
export function getGlobalConfidence(eventId: string): "high" | "medium" | "low" {
  const eventSignals = MOCK_SIGNALS.filter(s => s.event_id === eventId);
  
  if (eventSignals.length === 0) return "low";
  
  // Calculate average confidence weighted by signal type
  const avgConfidence =
    eventSignals.reduce((sum, s) => sum + s.confidence, 0) / eventSignals.length;
  
  // Check for recent field reports (high value)
  const hasRecentFieldReports = eventSignals.some(
    s => s.signal_type === "field_report" || s.signal_type === "official"
  );
  
  if (avgConfidence >= 0.85 && hasRecentFieldReports) return "high";
  if (avgConfidence >= 0.6) return "medium";
  return "low";
}

/**
 * Get dominant signal types for a specific gap
 */
export function getDominantSignalTypesForGap(
  sectorId: string,
  capacityTypeId: string
): SignalType[] {
  const signals = MOCK_SIGNALS.filter(s => s.sector_id === sectorId);
  
  // Count by type
  const typeCounts: Record<string, number> = {};
  signals.forEach(s => {
    typeCounts[s.signal_type] = (typeCounts[s.signal_type] || 0) + 1;
  });
  
  // Sort by count and take top 2
  const sortedTypes = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([type]) => type as SignalType);
  
  return sortedTypes;
}

/**
 * Get operating actors with full info
 */
export interface OperatingActorInfo {
  id: string;
  name: string;
  type: "ong" | "state" | "private" | "volunteer";
  sectors: string[];
  capacity: string;
  lastConfirmation: string;
  gapId?: string;
  contact?: {
    name: string;
    role?: string;
    phone?: string;
    email?: string;
  };
}

export function getOperatingActorsForEvent(eventId: string): OperatingActorInfo[] {
  const operatingDeployments = MOCK_DEPLOYMENTS.filter(
    d => d.event_id === eventId && d.status === "operating"
  );
  
  // Group by actor_id
  const actorDeployments: Record<string, typeof operatingDeployments> = {};
  operatingDeployments.forEach(d => {
    if (!actorDeployments[d.actor_id]) {
      actorDeployments[d.actor_id] = [];
    }
    actorDeployments[d.actor_id].push(d);
  });
  
  // Mock actor details
  const actorDetails: Record<string, { name: string; type: "ong" | "state" | "private" | "volunteer"; contact: OperatingActorInfo["contact"] }> = {
    "mock-actor-1": {
      name: "Cruz Roja Chile",
      type: "ong",
      contact: {
        name: "María González",
        role: "Coordinadora Emergencias",
        phone: "+56 9 1234 5678",
        email: "mgonzalez@cruzroja.cl",
      },
    },
    "mock-admin-1": {
      name: "Bomberos Voluntarios",
      type: "volunteer",
      contact: {
        name: "Pedro Fernández",
        role: "Jefe de Operaciones",
        phone: "+56 9 8765 4321",
      },
    },
  };
  
  return Object.entries(actorDeployments).map(([actorId, deployments]) => {
    const sectors = deployments.map(d => {
      const sector = getSectorById(d.sector_id);
      return sector?.canonical_name || "Sector desconocido";
    });
    
    const capacity = deployments.map(d => {
      const cap = getCapacityTypeById(d.capacity_type_id);
      return cap?.name || "Capacidad";
    }).join(", ");
    
    const latestDeployment = deployments.sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )[0];
    
    const details = actorDetails[actorId];
    const name = details?.name || "Organización Anónima";
    const type = details?.type || "ong";
    const contact = details?.contact;
    
    return {
      id: actorId,
      name,
      type,
      sectors: [...new Set(sectors)],
      capacity,
      lastConfirmation: latestDeployment.updated_at,
      contact,
    };
  });
}

// ============== ACTOR NETWORK (Structural, non-operational) ==============

export const MOCK_ACTORS_NETWORK: Actor[] = [
  {
    id: "actor-net-1",
    user_id: "mock-actor-1",
    organization_name: "Cruz Roja Chile",
    organization_type: "ong",
    description: "Organización humanitaria con presencia nacional, especializada en respuesta a emergencias y desastres.",
    structural_status: "active",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-15T00:00:00Z",
  },
  {
    id: "actor-net-2",
    user_id: "mock-admin-1",
    organization_name: "Bomberos Voluntarios Chillán",
    organization_type: "volunteer",
    description: "Cuerpo de bomberos con capacidad de rescate y combate de incendios forestales.",
    structural_status: "active",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-10T00:00:00Z",
  },
  {
    id: "actor-net-3",
    user_id: "mock-state-1",
    organization_name: "ONEMI Regional Ñuble",
    organization_type: "state",
    description: "Oficina Nacional de Emergencias - Región de Ñuble. Coordinación interinstitucional.",
    structural_status: "active",
    created_at: "2024-12-01T00:00:00Z",
    updated_at: "2025-01-05T00:00:00Z",
  },
  {
    id: "actor-net-4",
    user_id: "mock-private-1",
    organization_name: "Transporte Andes SpA",
    organization_type: "private",
    description: "Empresa de transporte con flota de camiones disponible para emergencias.",
    structural_status: "active",
    created_at: "2024-11-15T00:00:00Z",
    updated_at: "2025-01-02T00:00:00Z",
  },
  {
    id: "actor-net-5",
    user_id: "mock-vol-1",
    organization_name: "Voluntarios por Chile",
    organization_type: "volunteer",
    description: "Red de voluntarios para apoyo logístico en emergencias.",
    structural_status: "inactive",
    created_at: "2024-10-01T00:00:00Z",
    updated_at: "2024-12-20T00:00:00Z",
  },
];

export const MOCK_ACTOR_CAPABILITIES_DECLARED: ActorCapabilityDeclared[] = [
  // Cruz Roja
  { id: "acd-1", actor_id: "actor-net-1", capacity_type_id: "cap-2", level: "specialized", notes: "Flota de 15 vehículos 4x4 con equipamiento", created_at: "2025-01-01T00:00:00Z", updated_at: "2025-01-01T00:00:00Z" },
  { id: "acd-2", actor_id: "actor-net-1", capacity_type_id: "cap-3", level: "operational", notes: "2 ambulancias básicas", created_at: "2025-01-01T00:00:00Z", updated_at: "2025-01-01T00:00:00Z" },
  { id: "acd-3", actor_id: "actor-net-1", capacity_type_id: "cap-5", level: "specialized", notes: "Cocina móvil para 500 personas", created_at: "2025-01-01T00:00:00Z", updated_at: "2025-01-01T00:00:00Z" },
  // Bomberos
  { id: "acd-4", actor_id: "actor-net-2", capacity_type_id: "cap-1", level: "specialized", notes: "3 carros bomba, 2 cisternas", created_at: "2025-01-01T00:00:00Z", updated_at: "2025-01-01T00:00:00Z" },
  { id: "acd-5", actor_id: "actor-net-2", capacity_type_id: "cap-8", level: "specialized", notes: "Equipo SAR certificado", created_at: "2025-01-01T00:00:00Z", updated_at: "2025-01-01T00:00:00Z" },
  // ONEMI
  { id: "acd-6", actor_id: "actor-net-3", capacity_type_id: "cap-7", level: "specialized", notes: "Red de comunicaciones regional", created_at: "2024-12-01T00:00:00Z", updated_at: "2024-12-01T00:00:00Z" },
  { id: "acd-7", actor_id: "actor-net-3", capacity_type_id: "cap-4", level: "operational", notes: "Coordinación de albergues", created_at: "2024-12-01T00:00:00Z", updated_at: "2024-12-01T00:00:00Z" },
  // Transporte Andes
  { id: "acd-8", actor_id: "actor-net-4", capacity_type_id: "cap-2", level: "specialized", notes: "20 camiones de carga", created_at: "2024-11-15T00:00:00Z", updated_at: "2024-11-15T00:00:00Z" },
  { id: "acd-9", actor_id: "actor-net-4", capacity_type_id: "cap-6", level: "operational", notes: "2 retroexcavadoras", created_at: "2024-11-15T00:00:00Z", updated_at: "2024-11-15T00:00:00Z" },
  // Voluntarios
  { id: "acd-10", actor_id: "actor-net-5", capacity_type_id: "cap-5", level: "basic", notes: "Preparación de alimentos", created_at: "2024-10-01T00:00:00Z", updated_at: "2024-10-01T00:00:00Z" },
];

export const MOCK_ACTOR_ZONES: ActorHabitualZone[] = [
  // Cruz Roja
  { id: "zone-1", actor_id: "actor-net-1", region: "Ñuble", commune: null, presence_type: "habitual", created_at: "2025-01-01T00:00:00Z" },
  { id: "zone-2", actor_id: "actor-net-1", region: "Biobío", commune: "Concepción", presence_type: "occasional", created_at: "2025-01-01T00:00:00Z" },
  { id: "zone-3", actor_id: "actor-net-1", region: "Maule", commune: null, presence_type: "occasional", created_at: "2025-01-01T00:00:00Z" },
  // Bomberos
  { id: "zone-4", actor_id: "actor-net-2", region: "Ñuble", commune: "Chillán", presence_type: "habitual", created_at: "2025-01-01T00:00:00Z" },
  { id: "zone-5", actor_id: "actor-net-2", region: "Ñuble", commune: "San Carlos", presence_type: "habitual", created_at: "2025-01-01T00:00:00Z" },
  // ONEMI
  { id: "zone-6", actor_id: "actor-net-3", region: "Ñuble", commune: null, presence_type: "habitual", created_at: "2024-12-01T00:00:00Z" },
  // Transporte Andes
  { id: "zone-7", actor_id: "actor-net-4", region: "Ñuble", commune: null, presence_type: "habitual", created_at: "2024-11-15T00:00:00Z" },
  { id: "zone-8", actor_id: "actor-net-4", region: "Biobío", commune: null, presence_type: "habitual", created_at: "2024-11-15T00:00:00Z" },
  // Voluntarios
  { id: "zone-9", actor_id: "actor-net-5", region: "Metropolitana", commune: null, presence_type: "habitual", created_at: "2024-10-01T00:00:00Z" },
];

export const MOCK_ACTOR_CONTACTS: ActorContact[] = [
  // Cruz Roja
  { id: "contact-1", actor_id: "actor-net-1", name: "María González", role: "Coordinadora Emergencias", primary_channel: "+56 9 1234 5678", secondary_channel: "mgonzalez@cruzroja.cl", is_primary: true, created_at: "2025-01-01T00:00:00Z", updated_at: "2025-01-01T00:00:00Z" },
  { id: "contact-2", actor_id: "actor-net-1", name: "Carlos Muñoz", role: "Jefe Logística", primary_channel: "+56 9 2345 6789", secondary_channel: null, is_primary: false, created_at: "2025-01-01T00:00:00Z", updated_at: "2025-01-01T00:00:00Z" },
  // Bomberos
  { id: "contact-3", actor_id: "actor-net-2", name: "Pedro Fernández", role: "Comandante", primary_channel: "+56 9 8765 4321", secondary_channel: "comandancia@bomberos.cl", is_primary: true, created_at: "2025-01-01T00:00:00Z", updated_at: "2025-01-01T00:00:00Z" },
  // ONEMI
  { id: "contact-4", actor_id: "actor-net-3", name: "Ana Sepúlveda", role: "Directora Regional", primary_channel: "+56 9 5555 1234", secondary_channel: "asepulveda@onemi.gov.cl", is_primary: true, created_at: "2024-12-01T00:00:00Z", updated_at: "2024-12-01T00:00:00Z" },
  // Transporte Andes
  { id: "contact-5", actor_id: "actor-net-4", name: "Roberto Silva", role: "Gerente Operaciones", primary_channel: "+56 9 7777 8888", secondary_channel: "rsilva@transporteandes.cl", is_primary: true, created_at: "2024-11-15T00:00:00Z", updated_at: "2024-11-15T00:00:00Z" },
];

export const MOCK_ACTOR_PARTICIPATION_HISTORY: ActorParticipationHistory[] = [
  // Cruz Roja
  { event_id: "evt-mock-3", event_name: "Inundación Valdivia 2025", capacities_activated: ["Transporte", "Alimentación"], sectors_operated: ["Valdivia Centro", "Isla Teja"], started_at: "2025-01-05T00:00:00Z", ended_at: "2025-01-15T00:00:00Z" },
  { event_id: "evt-old-1", event_name: "Incendios Valparaíso 2024", capacities_activated: ["Transporte", "Salud", "Alimentación"], sectors_operated: ["Cerro Alegre", "Cerro Barón"], started_at: "2024-02-01T00:00:00Z", ended_at: "2024-02-20T00:00:00Z" },
  // Bomberos
  { event_id: "evt-old-2", event_name: "Incendio Forestal Coihueco 2024", capacities_activated: ["Agua y Bomberos", "Búsqueda y Rescate"], sectors_operated: ["Coihueco Rural", "Pinto"], started_at: "2024-01-15T00:00:00Z", ended_at: "2024-01-25T00:00:00Z" },
];

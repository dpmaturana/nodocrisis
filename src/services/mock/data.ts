import type { CapacityType, Sector, Event } from "@/types/database";

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

export const MOCK_ACTIVE_EVENT: Event = {
  id: "evt-mock-1",
  name: "Incendios Forestales Ñuble 2026",
  type: "incendio_forestal",
  status: "active",
  location: "Región de Ñuble",
  description: "Incendios forestales activos en múltiples comunas de la región de Ñuble",
  started_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  created_by: null,
  ended_at: null,
};

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
];

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
};

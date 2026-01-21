import type { InitialSituationReport, SuggestedSector, SuggestedCapability } from "@/types/database";
import { MOCK_CAPACITY_TYPES } from "./data";

const EVENT_TYPE_KEYWORDS: Record<string, string[]> = {
  incendio_forestal: ["incendio", "fuego", "forestal", "llamas", "quema"],
  inundacion: ["inundación", "inundacion", "lluvia", "desborde", "crecida", "anegamiento"],
  terremoto: ["terremoto", "sismo", "temblor"],
  tsunami: ["tsunami", "maremoto"],
  aluvion: ["aluvión", "aluvion", "barro", "deslizamiento"],
  sequia: ["sequía", "sequia", "escasez", "falta de agua"],
  temporal: ["temporal", "tormenta", "viento"],
  emergencia_sanitaria: ["sanitaria", "epidemia", "brote", "contagio"],
};

const CAPABILITY_BY_EVENT_TYPE: Record<string, string[]> = {
  incendio_forestal: ["Agua y Bomberos", "Transporte", "Búsqueda y Rescate", "Salud", "Comunicaciones"],
  inundacion: ["Búsqueda y Rescate", "Albergue", "Transporte", "Maquinaria Pesada", "Alimentación"],
  terremoto: ["Búsqueda y Rescate", "Salud", "Albergue", "Maquinaria Pesada", "Comunicaciones"],
  tsunami: ["Búsqueda y Rescate", "Albergue", "Transporte", "Salud", "Alimentación"],
  aluvion: ["Maquinaria Pesada", "Búsqueda y Rescate", "Transporte", "Albergue", "Salud"],
  sequia: ["Agua y Bomberos", "Alimentación", "Transporte"],
  temporal: ["Albergue", "Comunicaciones", "Transporte", "Maquinaria Pesada"],
  emergencia_sanitaria: ["Salud", "Comunicaciones", "Transporte", "Albergue"],
  otro: ["Comunicaciones", "Transporte", "Salud"],
};

function detectEventType(text: string): string {
  const lowerText = text.toLowerCase();
  for (const [eventType, keywords] of Object.entries(EVENT_TYPE_KEYWORDS)) {
    if (keywords.some(kw => lowerText.includes(kw))) {
      return eventType;
    }
  }
  return "otro";
}

function extractPlaceNames(text: string): string[] {
  // Simple extraction - look for capitalized words that might be place names
  const placePatterns = [
    /(?:en|de|cerca de|sector|comuna|región)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*)/gi,
    /([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+(?:Rural|Centro|Norte|Sur|Este|Oeste|Viejo|Nuevo|Alto|Bajo))?)/g,
  ];
  
  const places = new Set<string>();
  for (const pattern of placePatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const place = match[1]?.trim();
      if (place && place.length > 3 && !["Incendio", "Fuego", "Emergencia", "Sector", "Región"].includes(place)) {
        places.add(place);
      }
    }
  }
  
  // Fallback sectors if none detected
  if (places.size === 0) {
    return ["Sector Central", "Zona Periurbana", "Área Rural"];
  }
  
  return Array.from(places).slice(0, 5);
}

function generateEventName(text: string, eventType: string): string {
  const typeNames: Record<string, string> = {
    incendio_forestal: "Incendios Forestales",
    inundacion: "Inundaciones",
    terremoto: "Terremoto",
    tsunami: "Tsunami",
    aluvion: "Aluvión",
    sequia: "Sequía",
    temporal: "Temporal",
    emergencia_sanitaria: "Emergencia Sanitaria",
    otro: "Emergencia",
  };
  
  const places = extractPlaceNames(text);
  const mainPlace = places[0] || "Zona Afectada";
  const year = new Date().getFullYear();
  
  return `${typeNames[eventType] || "Emergencia"} ${mainPlace} ${year}`;
}

export function generateMockReport(inputText: string): InitialSituationReport {
  const eventType = detectEventType(inputText);
  const places = extractPlaceNames(inputText);
  
  // Generate suggested sectors
  const suggestedSectors: SuggestedSector[] = places.map((place, index) => ({
    name: place,
    description: `Sector afectado identificado en el texto de entrada`,
    confidence: 0.65 + Math.random() * 0.3,
    include: true,
  }));
  
  // Generate suggested capabilities based on event type
  const capabilityNames = CAPABILITY_BY_EVENT_TYPE[eventType] || CAPABILITY_BY_EVENT_TYPE.otro;
  const suggestedCapabilities: SuggestedCapability[] = capabilityNames.map((name, index) => {
    const capType = MOCK_CAPACITY_TYPES.find(c => c.name === name);
    return {
      capability_name: name,
      confidence: 0.7 + Math.random() * 0.25 - index * 0.05,
      include: true,
    };
  });
  
  // Generate summary
  const summary = inputText.length > 200 
    ? `${inputText.substring(0, 200)}...` 
    : inputText;
  
  return {
    id: `report-${Date.now()}`,
    status: "draft",
    input_text: inputText,
    event_name_suggested: generateEventName(inputText, eventType),
    event_type: eventType,
    summary: `Situación de emergencia: ${summary}`,
    suggested_sectors: suggestedSectors,
    suggested_capabilities: suggestedCapabilities,
    sources: ["Texto ingresado por coordinador"],
    overall_confidence: 0.65 + Math.random() * 0.25,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: null,
    linked_event_id: null,
  };
}

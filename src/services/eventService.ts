import { supabase } from "@/integrations/supabase/client";
import { simulateDelay } from "./mock/delay";
import { 
  MOCK_EVENTS, 
  MOCK_SECTORS, 
  MOCK_CAPACITY_TYPES,
  MOCK_SECTOR_CAPABILITY_MATRIX,
  MOCK_DEPLOYMENTS,
  getEventById,
  getSectorsByEventId,
  getDeploymentsByEventId,
  addEvent,
  addSector,
} from "./mock/data";
import type { Event, Sector, CapacityType, SectorGap, NeedLevel } from "@/types/database";
import type { NeedLevelExtended } from "./mock/data";

export const eventService = {
  async getAll(): Promise<Event[]> {
    await simulateDelay(200);
    return [...MOCK_EVENTS].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },

  async getActive(): Promise<Event[]> {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Event[];
  },

  async getById(id: string): Promise<Event | null> {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return data as Event;
    // Fall back to mock data for legacy mock event IDs
    return getEventById(id) || null;
  },

  async create(event: Partial<Event>): Promise<Event> {
    await simulateDelay(300);
    return addEvent({
      name: event.name || "Nuevo Evento",
      population_affected: event.population_affected ?? null,
      type: event.type || null,
      status: "active",
      location: event.location || null,
      description: event.description || null,
      started_at: new Date().toISOString(),
      ended_at: null,
      created_by: null,
    });
  },

  async getSectorsForEvent(eventId: string): Promise<Sector[]> {
    await simulateDelay(150);
    return getSectorsByEventId(eventId);
  },

  async getCapacityTypes(): Promise<CapacityType[]> {
    await simulateDelay(100);
    return [...MOCK_CAPACITY_TYPES];
  },

  async getGapsForEvent(eventId: string): Promise<Map<string, Map<string, SectorGap>>> {
    await simulateDelay(200);
    const sectors = getSectorsByEventId(eventId);
    const deployments = getDeploymentsByEventId(eventId);
    const gapMap = new Map<string, Map<string, SectorGap>>();

    sectors.forEach(sector => {
      const sectorGaps = new Map<string, SectorGap>();
      const matrix = MOCK_SECTOR_CAPABILITY_MATRIX[sector.id] || {};

      MOCK_CAPACITY_TYPES.forEach(capacity => {
        const level = matrix[capacity.id] as NeedLevelExtended || "unknown";
        if (level === "unknown") return;

        const sectorDeployments = deployments.filter(
          d => d.sector_id === sector.id && 
               d.capacity_type_id === capacity.id &&
               (d.status === "operating" || d.status === "confirmed")
        );

        const coverage = sectorDeployments.length;
        const isCovered = level === "covered";
        const needLevel = isCovered ? "low" : level as NeedLevel;
        const demand = isCovered ? 0 : (level === "critical" ? 3 : level === "high" ? 2 : 1);
        const gap = Math.max(0, demand - coverage);

        sectorGaps.set(capacity.id, {
          sector,
          capacityType: capacity,
          smsDemand: 0,
          contextDemand: demand,
          totalDemand: demand,
          coverage,
          gap,
          isUncovered: !isCovered && coverage === 0 && demand > 0,
          isCritical: level === "critical" || level === "high",
          maxLevel: needLevel,
        });
      });

      if (sectorGaps.size > 0) {
        gapMap.set(sector.id, sectorGaps);
      }
    });

    return gapMap;
  },

  async addSector(eventId: string, name: string, aliases?: string[]): Promise<Sector> {
    await simulateDelay(300);
    return addSector({
      event_id: eventId,
      canonical_name: name,
      population_affected: null,
      aliases: aliases || null,
      status: "unresolved",
      source: "manual",
      confidence: 1,
      latitude: null,
      longitude: null,
    });
  },
};

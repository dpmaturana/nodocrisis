import { supabase } from "@/integrations/supabase/client";
import type { Event, Sector, CapacityType, SectorGap, NeedLevel } from "@/types/database";

export const eventService = {
  async getAll(): Promise<Event[]> {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Event[];
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
    return (data as Event) ?? null;
  },

  async create(event: Partial<Event>): Promise<Event> {
    const { data, error } = await supabase
      .from("events")
      .insert({
        name: event.name || "Nuevo Evento",
        population_affected: event.population_affected ?? null,
        type: event.type || null,
        status: "active",
        location: event.location || null,
        description: event.description || null,
        started_at: new Date().toISOString(),
        ended_at: null,
        created_by: null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as Event;
  },

  async getSectorsForEvent(eventId: string): Promise<Sector[]> {
    const { data, error } = await supabase
      .from("sectors")
      .select("*")
      .eq("event_id", eventId);
    if (error) throw new Error(error.message);
    return (data ?? []) as Sector[];
  },

  async getCapacityTypes(): Promise<CapacityType[]> {
    const { data, error } = await supabase
      .from("capacity_types")
      .select("*")
      .order("name");
    if (error) throw new Error(error.message);
    return (data ?? []) as CapacityType[];
  },

  async getGapsForEvent(eventId: string): Promise<Map<string, Map<string, SectorGap>>> {
    const { data: dbSectors } = await supabase
      .from("sectors")
      .select("*")
      .eq("event_id", eventId);
    const sectors = (dbSectors ?? []) as Sector[];
    if (sectors.length === 0) return new Map();

    const sectorIds = sectors.map(s => s.id);

    const { data: dbNeeds } = await supabase
      .from("sector_needs_context")
      .select("*, capacity_types(*)")
      .eq("event_id", eventId);

    type NeedRow = {
      id: string;
      event_id: string;
      sector_id: string;
      capacity_type_id: string;
      level: string;
      capacity_types: CapacityType | null;
    };
    const needs = (dbNeeds ?? []) as NeedRow[];

    const { data: dbDeployments } = await supabase
      .from("deployments")
      .select("*")
      .in("sector_id", sectorIds)
      .in("status", ["operating", "confirmed"]);
    const deployments = dbDeployments ?? [];

    const sectorMap = new Map<string, Sector>();
    sectors.forEach(s => sectorMap.set(s.id, s));

    const gapMap = new Map<string, Map<string, SectorGap>>();

    for (const need of needs) {
      const sector = sectorMap.get(need.sector_id);
      const capType = need.capacity_types;
      if (!sector || !capType) continue;

      const level = need.level;
      const isCovered = level === "covered";
      const needLevel: NeedLevel = isCovered ? "low" : level as NeedLevel;
      const demand = isCovered ? 0 : (level === "critical" ? 3 : level === "high" ? 2 : 1);

      const sectorDeployments = deployments.filter(
        d => d.sector_id === sector.id && d.capacity_type_id === need.capacity_type_id &&
             (d.status === "operating" || d.status === "confirmed")
      );
      const coverage = sectorDeployments.length;
      const gap = Math.max(0, demand - coverage);

      if (!gapMap.has(sector.id)) {
        gapMap.set(sector.id, new Map());
      }

      gapMap.get(sector.id)!.set(capType.id, {
        sector,
        capacityType: capType,
        smsDemand: 0,
        contextDemand: demand,
        totalDemand: demand,
        coverage,
        gap,
        isUncovered: !isCovered && coverage === 0 && demand > 0,
        isCritical: level === "critical" || level === "high",
        maxLevel: needLevel,
      });
    }

    return gapMap;
  },

  async addSector(eventId: string, name: string, aliases?: string[]): Promise<Sector> {
    const { data, error } = await supabase
      .from("sectors")
      .insert({
        event_id: eventId,
        canonical_name: name,
        population_affected: null,
        aliases: aliases || null,
        status: "unresolved",
        source: "manual",
        confidence: 1,
        latitude: null,
        longitude: null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as Sector;
  },

  async addContextualDemand(params: {
    eventId: string;
    sectorId: string;
    capacityTypeId: string;
    level: string;
    source: string;
    notes?: string;
  }): Promise<void> {
    const { error } = await supabase
      .from("sector_needs_context")
      .upsert(
        {
          event_id: params.eventId,
          sector_id: params.sectorId,
          capacity_type_id: params.capacityTypeId,
          level: params.level,
          source: params.source,
          notes: params.notes || null,
          created_by: null,
          expires_at: null,
        },
        { onConflict: "event_id,sector_id,capacity_type_id" },
      );
    if (error) throw new Error(error.message);
  },
};

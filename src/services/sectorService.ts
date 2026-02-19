import { supabase } from "@/integrations/supabase/client";
import type { SectorContext, ActorInSector } from "./mock/data";
import type { Sector, Event, CapacityType, SectorGap, NeedLevel, Signal } from "@/types/database";

export interface RecommendedSector {
  sector: Sector;
  event: Event;
  gaps: SectorGap[];
  relevantGaps: SectorGap[]; // Only gaps matching user's capabilities
}

// New enriched sector for sector-centric ONG view
export interface EnrichedSector {
  sector: Sector;
  event: Event;
  state: "critical" | "partial" | "contained";
  context: SectorContext;
  gaps: SectorGap[];
  relevantGaps: SectorGap[];
  bestMatchGaps: SectorGap[];
  actorsInSector: ActorInSector[];
  recentSignals: Signal[];
}

/** Sort enriched sectors by severity → capability match → impact opportunity */
function sortEnrichedSectors(sectors: EnrichedSector[]): EnrichedSector[] {
  return sectors.sort((a, b) => {
    if (a.state === "critical" && b.state !== "critical") return -1;
    if (a.state !== "critical" && b.state === "critical") return 1;
    if (a.relevantGaps.length !== b.relevantGaps.length) {
      return b.relevantGaps.length - a.relevantGaps.length;
    }
    const aMinCoverage = Math.min(...a.gaps.map(g => g.coverage), Infinity);
    const bMinCoverage = Math.min(...b.gaps.map(g => g.coverage), Infinity);
    return aMinCoverage - bMinCoverage;
  });
}

/** Default context when no detailed context is available */
const DEFAULT_SECTOR_CONTEXT: SectorContext = {
  keyPoints: ["Sin información adicional"],
  extendedContext: "No hay contexto disponible para este sector.",
  operationalSummary: "Sector sin evaluación detallada.",
};

/** Build best-match gaps (top 2 relevant, sorted by criticality then gap size) */
function buildBestMatchGaps(relevantGaps: SectorGap[]): SectorGap[] {
  return [...relevantGaps]
    .sort((a, b) => {
      if (a.isCritical && !b.isCritical) return -1;
      if (!a.isCritical && b.isCritical) return 1;
      return b.gap - a.gap;
    })
    .slice(0, 2);
}

export const sectorService = {
  async getAll(): Promise<Sector[]> {
    const { data, error } = await supabase
      .from("sectors")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Sector[];
  },

  async getById(id: string): Promise<Sector | null> {
    const { data, error } = await supabase
      .from("sectors")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as Sector) ?? null;
  },

  async getByEventId(eventId: string): Promise<Sector[]> {
    const { data, error } = await supabase
      .from("sectors")
      .select("*")
      .eq("event_id", eventId);
    if (error) throw new Error(error.message);
    return (data ?? []) as Sector[];
  },

  /**
   * Get enriched sectors for sector-centric ONG view.
   * Queries Supabase for real data.
   * Sorted by: severity → match with actor capabilities → impact opportunity
   */
  async getEnrichedSectors(actorId: string): Promise<EnrichedSector[]> {
    // --- Try real DB first ---
    const { data: dbEvents } = await supabase
      .from("events")
      .select("*")
      .eq("status", "active");

    const activeEvents = (dbEvents ?? []) as Event[];
    if (activeEvents.length === 0) return [];

    const eventIds = activeEvents.map(e => e.id);

    // Fetch actor capabilities from DB
    const { data: dbCaps } = await supabase
      .from("actor_capabilities")
      .select("*")
      .eq("user_id", actorId);

    const myCapabilityTypeIds = (dbCaps ?? [])
      .filter(c => c.availability !== "unavailable")
      .map(c => c.capacity_type_id);

    // Fetch sectors for active events
    const { data: dbSectors } = await supabase
      .from("sectors")
      .select("*")
      .in("event_id", eventIds);

    const sectors = (dbSectors ?? []) as Sector[];
    if (sectors.length === 0) return [];

    const sectorIds = sectors.map(s => s.id);

    // Fetch needs with capacity type details
    const { data: dbNeeds } = await supabase
      .from("sector_needs_context")
      .select("*, capacity_types(*)")
      .in("event_id", eventIds);

    type NeedRow = {
      id: string;
      event_id: string;
      sector_id: string;
      capacity_type_id: string;
      level: string;
      capacity_types: CapacityType | null;
    };
    const needs = (dbNeeds ?? []) as NeedRow[];

    // Fetch active deployments for these sectors
    const { data: dbDeployments } = await supabase
      .from("deployments")
      .select("*")
      .in("sector_id", sectorIds)
      .in("status", ["operating", "confirmed"]);

    const deployments = dbDeployments ?? [];

    // Fetch recent signals for these sectors
    const { data: dbSignals } = await supabase
      .from("signals")
      .select("*")
      .in("sector_id", sectorIds)
      .order("created_at", { ascending: false });

    const signals = (dbSignals ?? []) as Signal[];

    // Build event lookup
    const eventMap = new Map<string, Event>();
    activeEvents.forEach(e => eventMap.set(e.id, e));

    // Group needs by sector_id
    const needsBySector = new Map<string, NeedRow[]>();
    needs.forEach(n => {
      if (!needsBySector.has(n.sector_id)) needsBySector.set(n.sector_id, []);
      needsBySector.get(n.sector_id)!.push(n);
    });

    const enrichedSectors: EnrichedSector[] = [];

    for (const sector of sectors) {
      const event = eventMap.get(sector.event_id);
      if (!event) continue;

      const sectorNeeds = needsBySector.get(sector.id) ?? [];
      const gaps: SectorGap[] = [];

      for (const need of sectorNeeds) {
        const capType = need.capacity_types;
        if (!capType) continue;

        const level = need.level as NeedLevel;
        const sectorDeployments = deployments.filter(
          d => d.sector_id === sector.id && d.capacity_type_id === need.capacity_type_id
        );

        const coverage = sectorDeployments.length;
        const demand = level === "critical" ? 3 : level === "high" ? 2 : 1;
        const gap = Math.max(0, demand - coverage);

        if (gap > 0) {
          gaps.push({
            sector,
            capacityType: capType,
            smsDemand: 0,
            contextDemand: demand,
            totalDemand: demand,
            coverage,
            gap,
            isUncovered: coverage === 0,
            isCritical: level === "critical" || level === "high",
            maxLevel: level,
          });
        }
      }

      if (gaps.length === 0) continue;

      const relevantGaps = gaps.filter(g =>
        myCapabilityTypeIds.includes(g.capacityType.id)
      );

      const hasCritical = gaps.some(g => g.isCritical);
      const state: EnrichedSector["state"] = hasCritical ? "critical" : "partial";

      const sectorSignals = signals
        .filter(s => s.sector_id === sector.id)
        .slice(0, 5);

      enrichedSectors.push({
        sector,
        event,
        state,
        context: DEFAULT_SECTOR_CONTEXT,
        gaps,
        relevantGaps,
        bestMatchGaps: buildBestMatchGaps(relevantGaps),
        actorsInSector: [],
        recentSignals: sectorSignals,
      });
    }

    return sortEnrichedSectors(enrichedSectors);
  },

  async getRecommended(actorId: string): Promise<RecommendedSector[]> {
    const { data: dbEvents } = await supabase
      .from("events")
      .select("*")
      .eq("status", "active");

    const activeEvents = (dbEvents ?? []) as Event[];
    if (activeEvents.length === 0) return [];

    const eventIds = activeEvents.map(e => e.id);

    // Fetch actor capabilities from DB
    const { data: dbCaps } = await supabase
      .from("actor_capabilities")
      .select("*")
      .eq("user_id", actorId);

    const myCapabilityTypeIds = (dbCaps ?? [])
      .filter(c => c.availability !== "unavailable")
      .map(c => c.capacity_type_id);

    // Fetch sectors for active events
    const { data: dbSectors } = await supabase
      .from("sectors")
      .select("*")
      .in("event_id", eventIds);

    const sectors = (dbSectors ?? []) as Sector[];
    if (sectors.length === 0) return [];

    // Fetch needs with capacity type details
    const { data: dbNeeds } = await supabase
      .from("sector_needs_context")
      .select("*, capacity_types(*)")
      .in("event_id", eventIds);

    type NeedRow = {
      id: string;
      event_id: string;
      sector_id: string;
      capacity_type_id: string;
      level: string;
      capacity_types: CapacityType | null;
    };
    const needs = (dbNeeds ?? []) as NeedRow[];

    // Fetch active deployments
    const sectorIds = sectors.map(s => s.id);
    const { data: dbDeployments } = await supabase
      .from("deployments")
      .select("*")
      .in("sector_id", sectorIds)
      .in("status", ["operating", "confirmed"]);

    const deployments = dbDeployments ?? [];

    // Build event lookup
    const eventMap = new Map<string, Event>();
    activeEvents.forEach(e => eventMap.set(e.id, e));

    // Group needs by sector_id
    const needsBySector = new Map<string, NeedRow[]>();
    needs.forEach(n => {
      if (!needsBySector.has(n.sector_id)) needsBySector.set(n.sector_id, []);
      needsBySector.get(n.sector_id)!.push(n);
    });

    const recommendations: RecommendedSector[] = [];

    for (const sector of sectors) {
      const event = eventMap.get(sector.event_id);
      if (!event) continue;

      const sectorNeeds = needsBySector.get(sector.id) ?? [];
      const gaps: SectorGap[] = [];

      for (const need of sectorNeeds) {
        const capType = need.capacity_types;
        if (!capType) continue;

        const level = need.level as NeedLevel;
        const sectorDeployments = deployments.filter(
          d => d.sector_id === sector.id && d.capacity_type_id === need.capacity_type_id
        );

        const coverage = sectorDeployments.length;
        const demand = level === "critical" ? 3 : level === "high" ? 2 : 1;
        const gap = Math.max(0, demand - coverage);

        if (gap > 0) {
          gaps.push({
            sector,
            capacityType: capType,
            smsDemand: 0,
            contextDemand: demand,
            totalDemand: demand,
            coverage,
            gap,
            isUncovered: coverage === 0,
            isCritical: level === "critical" || level === "high",
            maxLevel: level,
          });
        }
      }

      if (gaps.length > 0) {
        const relevantGaps = gaps.filter(g =>
          myCapabilityTypeIds.includes(g.capacityType.id)
        );

        recommendations.push({
          sector,
          event,
          gaps,
          relevantGaps,
        });
      }
    }

    // Sort by urgency (critical first, then by gap size)
    recommendations.sort((a, b) => {
      const aMaxCritical = a.gaps.some(g => g.isCritical);
      const bMaxCritical = b.gaps.some(g => g.isCritical);
      if (aMaxCritical && !bMaxCritical) return -1;
      if (!aMaxCritical && bMaxCritical) return 1;

      const aMaxGap = Math.max(...a.gaps.map(g => g.gap));
      const bMaxGap = Math.max(...b.gaps.map(g => g.gap));
      return bMaxGap - aMaxGap;
    });

    return recommendations;
  },

  async getActiveEvents(): Promise<Event[]> {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Event[];
  },
};

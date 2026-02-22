import { supabase } from "@/integrations/supabase/client";
import type { SectorContext, ActorInSector } from "./deploymentService";
import type { Sector, Event, CapacityType, SectorGap, NeedLevel, Signal } from "@/types/database";
import { computeSectorSeverity } from "@/lib/sectorNeedAggregation";
import type { NeedCriticalityLevel } from "@/lib/sectorNeedAggregation";
import type { NeedStatus } from "@/lib/needStatus";
import { mapNeedLevelToNeedStatus } from "@/services/needSignalService";

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
  resolvedGaps?: SectorGap[];
}

function needStatusToSectorState(status: NeedStatus): EnrichedSector["state"] {
  if (status === "RED") return "critical";
  if (status === "ORANGE" || status === "YELLOW") return "partial";
  return "contained";
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
      notes: string | null;
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

    // Fetch profiles for deployed actors to resolve names
    const deployedActorIds = [...new Set(deployments.map(d => d.actor_id))];
    const profileMap = new Map<string, string>();
    if (deployedActorIds.length > 0) {
      const { data: dbProfiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, organization_name")
        .in("user_id", deployedActorIds);
      (dbProfiles ?? []).forEach((p: any) => {
        profileMap.set(p.user_id, p.organization_name || p.full_name || p.user_id);
      });
    }

    // Fetch latest need_audits for reasoning summaries
    const { data: dbAudits } = await supabase
      .from("need_audits")
      .select("sector_id, capability_id, reasoning_summary, timestamp")
      .in("sector_id", sectorIds)
      .order("timestamp", { ascending: false });

    const auditMap = new Map<string, string>();
    (dbAudits ?? []).forEach((a: any) => {
      const key = `${a.sector_id}:${a.capability_id}`;
      if (!auditMap.has(key) && a.reasoning_summary) {
        auditMap.set(key, a.reasoning_summary);
      }
    });

    // Fetch actor's own active deployments to exclude already-subscribed sectors
    const { data: dbActorDeployments } = await supabase
      .from("deployments")
      .select("sector_id")
      .eq("actor_id", actorId)
      .in("sector_id", sectorIds)
      .not("status", "in", '("finished","suspended")');

    const subscribedSectorIds = new Set(
      (dbActorDeployments ?? []).map((d: { sector_id: string }) => d.sector_id)
    );

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
      // Skip sectors where this actor already has an active deployment
      if (subscribedSectorIds.has(sector.id)) continue;

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
          // Parse notes JSON for requirements and description
          let operational_requirements: string[] = [];
          let reasoning_summary: string | undefined;
          if (need.notes) {
            try {
              const parsed = JSON.parse(need.notes);
              if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                operational_requirements = Array.isArray(parsed.requirements) ? parsed.requirements : [];
                if (typeof parsed.description === "string") reasoning_summary = parsed.description;
              } else if (Array.isArray(parsed)) {
                operational_requirements = parsed;
              }
            } catch {
              reasoning_summary = need.notes; // legacy plain text
            }
          }
          // Fallback to need_audits reasoning
          if (!reasoning_summary) {
            reasoning_summary = auditMap.get(`${sector.id}:${need.capacity_type_id}`);
          }

          // Resolve covering actors with names
          const coveringActors = sectorDeployments.map(d => ({
            name: profileMap.get(d.actor_id) || d.actor_id,
            status: d.status as string,
          }));

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
            operational_requirements,
            reasoning_summary,
            coveringActors,
          });
        }
      }

      if (gaps.length === 0) continue;

      const relevantGaps = gaps.filter(g =>
        myCapabilityTypeIds.includes(g.capacityType.id)
      );

      // Compute sector severity using all needs (not just those with gaps)
      const sectorAgg = computeSectorSeverity(
        sectorNeeds.map(need => ({
          need_id: need.id,
          need_status: mapNeedLevelToNeedStatus(need.level as NeedLevel),
          criticality_level: (need.capacity_types?.criticality_level as NeedCriticalityLevel) ?? "medium",
          population_weight: 1,
        }))
      );
      const state = needStatusToSectorState(sectorAgg.status);

      const sectorSignals = signals
        .filter(s => s.sector_id === sector.id)
        .slice(0, 5);

      const sectorDeploymentActors = deployments
        .filter(d => d.sector_id === sector.id)
        .map((d: any) => ({
          id: d.actor_id as string,
          name: profileMap.get(d.actor_id) || (d.actor_id as string),
          role: "actor",
          capacity: d.capacity_type_id as string,
          status: d.status as "operating" | "confirmed",
        }));

      enrichedSectors.push({
        sector,
        event,
        state,
        context: DEFAULT_SECTOR_CONTEXT,
        gaps,
        relevantGaps,
        bestMatchGaps: buildBestMatchGaps(relevantGaps),
        actorsInSector: sectorDeploymentActors,
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

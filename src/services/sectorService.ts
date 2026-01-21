import { simulateDelay } from "./mock/delay";
import { 
  MOCK_SECTORS,
  MOCK_EVENTS,
  MOCK_CAPACITY_TYPES,
  MOCK_SECTOR_CAPABILITY_MATRIX,
  MOCK_DEPLOYMENTS,
  MOCK_GAPS,
  MOCK_SIGNALS,
  MOCK_SECTOR_CONTEXT,
  getCapabilitiesByActorId,
  getSectorById,
  getEventById,
  getCapacityTypeById,
  getActorsInSector,
  type SectorContext,
  type ActorInSector,
} from "./mock/data";
import type { Sector, Event, SectorGap, NeedLevel, Signal } from "@/types/database";
import type { NeedLevelExtended } from "./mock/data";

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

export const sectorService = {
  async getAll(): Promise<Sector[]> {
    await simulateDelay(200);
    return [...MOCK_SECTORS];
  },

  async getById(id: string): Promise<Sector | null> {
    await simulateDelay(100);
    return getSectorById(id) || null;
  },

  async getByEventId(eventId: string): Promise<Sector[]> {
    await simulateDelay(150);
    return MOCK_SECTORS.filter(s => s.event_id === eventId);
  },

  /**
   * Get enriched sectors for sector-centric ONG view
   * Sorted by: severity → match with actor capabilities → impact opportunity
   */
  async getEnrichedSectors(actorId: string): Promise<EnrichedSector[]> {
    await simulateDelay(300);
    
    const activeEvents = MOCK_EVENTS.filter(e => e.status === "active");
    const myCapabilities = getCapabilitiesByActorId(actorId);
    const myCapabilityTypeIds = myCapabilities
      .filter(c => c.availability !== "unavailable")
      .map(c => c.capacity_type_id);
    
    const enrichedSectors: EnrichedSector[] = [];

    for (const event of activeEvents) {
      const sectors = MOCK_SECTORS.filter(s => s.event_id === event.id);
      
      for (const sector of sectors) {
        const matrix = MOCK_SECTOR_CAPABILITY_MATRIX[sector.id] || {};
        const gaps: SectorGap[] = [];

        // Build gaps for this sector
        MOCK_CAPACITY_TYPES.forEach(capacity => {
          const level = matrix[capacity.id] as NeedLevelExtended || "unknown";
          if (level === "unknown" || level === "covered") return;

          const deployments = MOCK_DEPLOYMENTS.filter(
            d => d.sector_id === sector.id && 
                 d.capacity_type_id === capacity.id &&
                 (d.status === "operating" || d.status === "confirmed")
          );

          const coverage = deployments.length;
          const demand = level === "critical" ? 3 : level === "high" ? 2 : 1;
          const gap = Math.max(0, demand - coverage);

          if (gap > 0) {
            gaps.push({
              sector,
              capacityType: capacity,
              smsDemand: 0,
              contextDemand: demand,
              totalDemand: demand,
              coverage,
              gap,
              isUncovered: coverage === 0,
              isCritical: level === "critical" || level === "high",
              maxLevel: level as NeedLevel,
            });
          }
        });

        // Skip sectors without active gaps
        if (gaps.length === 0) continue;

        // Filter relevant gaps (matching actor's capabilities)
        const relevantGaps = gaps.filter(g => 
          myCapabilityTypeIds.includes(g.capacityType.id)
        );

        // Determine sector state
        const hasCritical = gaps.some(g => g.isCritical);
        const state: EnrichedSector["state"] = hasCritical ? "critical" : "partial";

        // Get best match gaps (top 2 relevant, sorted by criticality)
        const bestMatchGaps = [...relevantGaps]
          .sort((a, b) => {
            if (a.isCritical && !b.isCritical) return -1;
            if (!a.isCritical && b.isCritical) return 1;
            return b.gap - a.gap;
          })
          .slice(0, 2);

        // Get context
        const context = MOCK_SECTOR_CONTEXT[sector.id] || {
          keyPoints: ["Sin información adicional"],
          extendedContext: "No hay contexto disponible para este sector.",
          operationalSummary: "Sector sin evaluación detallada.",
        };

        // Get actors in sector
        const actorsInSector = getActorsInSector(sector.id);

        // Get recent signals
        const recentSignals = MOCK_SIGNALS
          .filter(s => s.sector_id === sector.id)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 5);

        enrichedSectors.push({
          sector,
          event,
          state,
          context,
          gaps,
          relevantGaps,
          bestMatchGaps,
          actorsInSector,
          recentSignals,
        });
      }
    }

    // Sort sectors by: severity → match → impact opportunity
    enrichedSectors.sort((a, b) => {
      // 1. Critical sectors first
      if (a.state === "critical" && b.state !== "critical") return -1;
      if (a.state !== "critical" && b.state === "critical") return 1;

      // 2. Sectors with more relevant gaps (better match)
      if (a.relevantGaps.length !== b.relevantGaps.length) {
        return b.relevantGaps.length - a.relevantGaps.length;
      }

      // 3. Sectors with lower coverage (more impact opportunity)
      const aMinCoverage = Math.min(...a.gaps.map(g => g.coverage), Infinity);
      const bMinCoverage = Math.min(...b.gaps.map(g => g.coverage), Infinity);
      return aMinCoverage - bMinCoverage;
    });

    return enrichedSectors;
  },

  async getRecommended(actorId: string): Promise<RecommendedSector[]> {
    await simulateDelay(300);
    
    const activeEvents = MOCK_EVENTS.filter(e => e.status === "active");
    const myCapabilities = getCapabilitiesByActorId(actorId);
    const myCapabilityTypeIds = myCapabilities
      .filter(c => c.availability !== "unavailable")
      .map(c => c.capacity_type_id);
    
    const recommendations: RecommendedSector[] = [];

    for (const event of activeEvents) {
      const sectors = MOCK_SECTORS.filter(s => s.event_id === event.id);
      
      for (const sector of sectors) {
        const matrix = MOCK_SECTOR_CAPABILITY_MATRIX[sector.id] || {};
        const gaps: SectorGap[] = [];

        MOCK_CAPACITY_TYPES.forEach(capacity => {
          const level = matrix[capacity.id] as NeedLevelExtended || "unknown";
          if (level === "unknown" || level === "covered") return;

          const deployments = MOCK_DEPLOYMENTS.filter(
            d => d.sector_id === sector.id && 
                 d.capacity_type_id === capacity.id &&
                 (d.status === "operating" || d.status === "confirmed")
          );

          const coverage = deployments.length;
          const demand = level === "critical" ? 3 : level === "high" ? 2 : 1;
          const gap = Math.max(0, demand - coverage);

          if (gap > 0) {
            gaps.push({
              sector,
              capacityType: capacity,
              smsDemand: 0,
              contextDemand: demand,
              totalDemand: demand,
              coverage,
              gap,
              isUncovered: coverage === 0,
              isCritical: level === "critical" || level === "high",
              maxLevel: level as NeedLevel,
            });
          }
        });

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
    await simulateDelay(100);
    return MOCK_EVENTS.filter(e => e.status === "active");
  },
};

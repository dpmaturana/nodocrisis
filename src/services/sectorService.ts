import { simulateDelay } from "./mock/delay";
import { 
  MOCK_SECTORS,
  MOCK_EVENTS,
  MOCK_CAPACITY_TYPES,
  MOCK_SECTOR_CAPABILITY_MATRIX,
  MOCK_DEPLOYMENTS,
  getCapabilitiesByActorId,
  getSectorById,
  getEventById,
  getCapacityTypeById,
} from "./mock/data";
import type { Sector, Event, SectorGap, NeedLevel } from "@/types/database";
import type { NeedLevelExtended } from "./mock/data";

export interface RecommendedSector {
  sector: Sector;
  event: Event;
  gaps: SectorGap[];
  relevantGaps: SectorGap[]; // Only gaps matching user's capabilities
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

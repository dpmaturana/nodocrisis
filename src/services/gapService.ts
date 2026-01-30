import { simulateDelay } from "./mock/delay";
import {
  MOCK_GAPS,
  MOCK_CAPACITY_TYPES,
  getVisibleGaps,
  getGapById as getGapByIdFromData,
  getGapsByEventId,
  getSignalsByGap,
  getSignalsBySector,
  getDeploymentsByGap,
  countGapsByState,
  getSectorsWithGaps as getSectorsWithGapsFromData,
  getSectorById,
  getCapacityTypeById,
  getEventById,
  getOperatingCount,
  MOCK_SECTOR_CONTEXT,
  getLastSignalForEvent,
  getGlobalConfidence,
  getDominantSignalTypesForGap,
  getOperatingActorsForEvent,
  type SectorContext,
  type OperatingActorInfo,
} from "./mock/data";
import { getGapStateConfig } from "@/lib/stateTransitions";
import type { Gap, GapState, Signal, Deployment, Sector, CapacityType, Event, SignalType } from "@/types/database";

export interface GapWithDetails extends Gap {
  sector?: Sector;
  capacity_type?: CapacityType;
  event?: Event;
  signals?: Signal[];
  coverage?: Deployment[];
}

export interface GapCounts {
  critical: number;
  partial: number;
  active: number;
  evaluating: number;
  sectorsWithGaps: number;
}

export interface SectorWithGaps {
  sector: Sector;
  context: SectorContext;
  gaps: GapWithDetails[];
  hasCritical: boolean;
  gapCounts: { critical: number; partial: number };
  gapSignalTypes: Record<string, SignalType[]>;
}

export interface OperatingActor {
  id: string;
  name: string;
  type: "ong" | "state" | "private" | "volunteer";
  sectors: string[];
  capacity: string;
  lastConfirmation: string | null;
  gapId?: string;
  contact?: {
    name: string;
    role?: string;
    phone?: string;
    email?: string;
  };
}

export interface DashboardMeta {
  lastSignal: Signal | null;
  globalConfidence: "high" | "medium" | "low";
  operatingCount: number;
}

export const gapService = {
  /**
   * Get only visible gaps (critical + partial) for dashboard
   */
  async getVisibleGapsForEvent(eventId: string): Promise<GapWithDetails[]> {
    await simulateDelay(150);
    const gaps = getVisibleGaps(eventId);
    
    return gaps.map(gap => ({
      ...gap,
      sector: getSectorById(gap.sector_id),
      capacity_type: getCapacityTypeById(gap.capacity_type_id),
      event: getEventById(gap.event_id),
    })).sort((a, b) => {
      // Critical first, then by last_updated_at
      if (a.state === 'critical' && b.state !== 'critical') return -1;
      if (a.state !== 'critical' && b.state === 'critical') return 1;
      return new Date(b.last_updated_at).getTime() - new Date(a.last_updated_at).getTime();
    });
  },

  /**
   * Get gaps grouped by sector for admin dashboard
   */
  async getGapsGroupedBySector(eventId: string): Promise<SectorWithGaps[]> {
    await simulateDelay(150);
    const visibleGaps = getVisibleGaps(eventId);
    
    // Group gaps by sector_id
    const gapsBySector: Record<string, Gap[]> = {};
    visibleGaps.forEach(gap => {
      if (!gapsBySector[gap.sector_id]) {
        gapsBySector[gap.sector_id] = [];
      }
      gapsBySector[gap.sector_id].push(gap);
    });
    
    // Build SectorWithGaps for each sector
    const sectorsWithGaps: SectorWithGaps[] = Object.entries(gapsBySector).map(([sectorId, gaps]) => {
      const sector = getSectorById(sectorId);
      const context = MOCK_SECTOR_CONTEXT[sectorId] || {
        keyPoints: [],
        extendedContext: "",
        operationalSummary: "",
      };
      
      const gapsWithDetails: GapWithDetails[] = gaps.map(gap => ({
        ...gap,
        sector: sector,
        capacity_type: getCapacityTypeById(gap.capacity_type_id),
        event: getEventById(gap.event_id),
        coverage: getDeploymentsByGap(gap.sector_id, gap.capacity_type_id),
      }));
      
      // Get signal types for each gap
      const gapSignalTypes: Record<string, SignalType[]> = {};
      gaps.forEach(gap => {
        gapSignalTypes[gap.id] = getDominantSignalTypesForGap(gap.sector_id, gap.capacity_type_id);
      });
      
      const criticalCount = gaps.filter(g => g.state === 'critical').length;
      const partialCount = gaps.filter(g => g.state === 'partial').length;
      
      return {
        sector: sector!,
        context,
        gaps: gapsWithDetails,
        hasCritical: criticalCount > 0,
        gapCounts: { critical: criticalCount, partial: partialCount },
        gapSignalTypes,
      };
    });
    
    // Sort: sectors with critical gaps first, then by number of critical, then partial
    return sectorsWithGaps.sort((a, b) => {
      if (a.hasCritical && !b.hasCritical) return -1;
      if (!a.hasCritical && b.hasCritical) return 1;
      if (a.gapCounts.critical !== b.gapCounts.critical) {
        return b.gapCounts.critical - a.gapCounts.critical;
      }
      return b.gapCounts.partial - a.gapCounts.partial;
    });
  },

  /**
   * Get all gaps including evaluating (for monitoring section)
   */
  async getAllGapsForEvent(eventId: string): Promise<GapWithDetails[]> {
    await simulateDelay(150);
    const gaps = getGapsByEventId(eventId);
    
    return gaps.map(gap => ({
      ...gap,
      sector: getSectorById(gap.sector_id),
      capacity_type: getCapacityTypeById(gap.capacity_type_id),
      event: getEventById(gap.event_id),
    }));
  },

  /**
   * Get gap detail with signals and coverage
   */
  async getGapById(gapId: string): Promise<GapWithDetails | null> {
    await simulateDelay(100);
    const gap = getGapByIdFromData(gapId);
    if (!gap) return null;

    const signals = getSignalsByGap(gap.sector_id, gap.capacity_type_id);
    const coverage = getDeploymentsByGap(gap.sector_id, gap.capacity_type_id);

    return {
      ...gap,
      sector: getSectorById(gap.sector_id),
      capacity_type: getCapacityTypeById(gap.capacity_type_id),
      event: getEventById(gap.event_id),
      signals,
      coverage,
    };
  },

  /**
   * Get signals for a specific gap
   */
  async getSignalsForGap(sectorId: string, capacityTypeId: string): Promise<Signal[]> {
    await simulateDelay(50);
    return getSignalsBySector(sectorId);
  },

  /**
   * Get counts for metrics cards
   */
  async getCounts(eventId: string): Promise<GapCounts> {
    await simulateDelay(100);
    const counts = countGapsByState(eventId);
    const sectorsWithGaps = getSectorsWithGapsFromData(eventId).length;

    return {
      ...counts,
      sectorsWithGaps,
    };
  },

  /**
   * Get dashboard meta info (last signal, global confidence, etc.)
   */
  async getDashboardMeta(eventId: string): Promise<DashboardMeta> {
    await simulateDelay(50);
    return {
      lastSignal: getLastSignalForEvent(eventId),
      globalConfidence: getGlobalConfidence(eventId),
      operatingCount: getOperatingCount(eventId),
    };
  },

  /**
   * Get operating actors for modal
   */
  async getOperatingActors(eventId: string): Promise<OperatingActor[]> {
    await simulateDelay(100);
    return getOperatingActorsForEvent(eventId);
  },

  /**
   * Get sectors that have visible gaps
   */
  async getSectorsWithGaps(eventId: string): Promise<string[]> {
    await simulateDelay(50);
    return getSectorsWithGapsFromData(eventId);
  },

  /**
   * Get evaluating gaps count (for collapsed section)
   */
  async getEvaluatingCount(eventId: string): Promise<number> {
    await simulateDelay(50);
    const counts = countGapsByState(eventId);
    return counts.evaluating;
  },

  // ============= UI Helpers =============

  getStateLabel(state: GapState): string {
    return getGapStateConfig(state).label;
  },

  getStateColor(state: GapState): string {
    return getGapStateConfig(state).text;
  },

  getStateBg(state: GapState): string {
    return getGapStateConfig(state).bg;
  },

  getStateIcon(state: GapState) {
    return getGapStateConfig(state).icon;
  },
};

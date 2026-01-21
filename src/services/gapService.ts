import { simulateDelay } from "./mock/delay";
import {
  MOCK_GAPS,
  MOCK_CAPACITY_TYPES,
  getVisibleGaps,
  getGapById as getGapByIdFromData,
  getGapsByEventId,
  getSignalsByGap,
  getDeploymentsByGap,
  countGapsByState,
  getSectorsWithGaps as getSectorsWithGapsFromData,
  getSectorById,
  getCapacityTypeById,
  getEventById,
} from "./mock/data";
import { getGapStateConfig } from "@/lib/stateTransitions";
import type { Gap, GapState, Signal, Deployment, Sector, CapacityType, Event } from "@/types/database";

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

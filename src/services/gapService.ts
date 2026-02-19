import { supabase } from "@/integrations/supabase/client";
import { simulateDelay } from "./mock/delay";
import {
  MOCK_GAPS,
  MOCK_CAPACITY_TYPES,
  MOCK_SECTOR_CAPABILITY_MATRIX,
  MOCK_DEPLOYMENTS,
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
  getActorsInSector,
  type SectorContext,
  type OperatingActorInfo,
  type NeedLevelExtended,
} from "./mock/data";
import { getGapStateConfig } from "@/lib/stateTransitions";
import { mapGapStateToNeedStatus, NEED_STATUS_ORDER, type NeedStatus } from "@/lib/needStatus";
import { needSignalService } from "@/services/needSignalService";
import type { Gap, GapState, Signal, Deployment, Sector, CapacityType, Event, SignalType, SectorGap, NeedLevel } from "@/types/database";
import type { EnrichedSector } from "./sectorService";

export interface GapWithDetails extends Gap {
  sector?: Sector;
  capacity_type?: CapacityType;
  event?: Event;
  signals?: Signal[];
  coverage?: Deployment[];
  need_status?: NeedStatus;
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

/** Map a DB need_level to a GapState for the frontend */
function mapNeedLevelToGapState(level: string): GapState {
  switch (level) {
    case "critical":
    case "high":
      return "critical";
    case "medium":
      return "partial";
    case "low":
      return "active";
    default:
      return "evaluating";
  }
}

export const gapService = {
  /**
   * Get only visible gaps (critical + partial) for dashboard
   */
  async getVisibleGapsForEvent(eventId: string): Promise<GapWithDetails[]> {
    await simulateDelay(150);
    const gaps = getVisibleGaps(eventId);
    const enriched = await Promise.all(gaps.map(async (gap) => {
      const signals = getSignalsByGap(gap.sector_id, gap.capacity_type_id);
      const evaluatedNeed = await needSignalService.evaluateGapNeed({
        eventId: gap.event_id,
        sectorId: gap.sector_id,
        capabilityId: gap.capacity_type_id,
        signals,
      });

      return {
      ...gap,
      sector: getSectorById(gap.sector_id),
      capacity_type: getCapacityTypeById(gap.capacity_type_id),
      event: getEventById(gap.event_id),
      need_status: evaluatedNeed?.current_status ?? mapGapStateToNeedStatus(gap.state),
    }}));

    return enriched.sort((a, b) => {
      const orderDelta = NEED_STATUS_ORDER.indexOf(a.need_status ?? "WHITE") - NEED_STATUS_ORDER.indexOf(b.need_status ?? "WHITE");
      if (orderDelta !== 0) return orderDelta;
      return new Date(b.last_updated_at).getTime() - new Date(a.last_updated_at).getTime();
    });
  },

  /**
   * Get gaps grouped by sector for admin dashboard.
   * Queries Supabase first; falls back to mock data for legacy mock event IDs.
   */
  async getGapsGroupedBySector(eventId: string): Promise<SectorWithGaps[]> {
    // Try to fetch real sectors from DB
    const { data: dbSectors, error: sectorsError } = await supabase
      .from("sectors")
      .select("*")
      .eq("event_id", eventId);

    if (sectorsError || !dbSectors || dbSectors.length === 0) {
      // Fall back to mock data implementation for mock/legacy events
      return this._mockGetGapsGroupedBySector(eventId);
    }

    // Fetch sector_needs_context for this event, joined with capacity_types
    const { data: needs } = await supabase
      .from("sector_needs_context")
      .select("*, capacity_types(*)")
      .eq("event_id", eventId);

    // Type for the joined query result (Supabase joins append the relation as a nested object)
    type NeedWithCapType = NonNullable<typeof needs>[number] & {
      capacity_types: CapacityType | null;
    };
    const typedNeeds = (needs ?? []) as NeedWithCapType[];

    // Build sector lookup map
    const sectorMap = new Map<string, Sector>();
    dbSectors.forEach((s) => sectorMap.set(s.id, s as unknown as Sector));

    // Group needs by sector_id
    const needsBySector = new Map<string, NeedWithCapType[]>();
    typedNeeds.forEach((need) => {
      if (!needsBySector.has(need.sector_id)) {
        needsBySector.set(need.sector_id, []);
      }
      needsBySector.get(need.sector_id)!.push(need);
    });

    const result: SectorWithGaps[] = [];

    for (const [sectorId, sectorNeeds] of needsBySector.entries()) {
      const sector = sectorMap.get(sectorId);
      if (!sector || !sectorNeeds) continue;

      const gapsWithDetails: GapWithDetails[] = sectorNeeds.map((need) => {
        const state = mapNeedLevelToGapState(need.level);
        const needStatus = mapGapStateToNeedStatus(state);
        return {
          id: need.id,
          event_id: need.event_id,
          sector_id: need.sector_id,
          capacity_type_id: need.capacity_type_id,
          state,
          last_updated_at: need.created_at,
          signal_count: 0,
          sector,
          capacity_type: need.capacity_types ?? undefined,
          need_status: needStatus,
        };
      });

      const criticalCount = gapsWithDetails.filter((g) => g.need_status === "RED").length;
      const partialCount = gapsWithDetails.filter((g) => g.need_status === "ORANGE").length;

      result.push({
        sector,
        context: { keyPoints: [], extendedContext: "", operationalSummary: "" },
        gaps: gapsWithDetails,
        hasCritical: criticalCount > 0,
        gapCounts: { critical: criticalCount, partial: partialCount },
        gapSignalTypes: {},
      });
    }

    // Sort: sectors with critical gaps first
    return result.sort((a, b) => {
      if (a.hasCritical && !b.hasCritical) return -1;
      if (!a.hasCritical && b.hasCritical) return 1;
      if (a.gapCounts.critical !== b.gapCounts.critical) {
        return b.gapCounts.critical - a.gapCounts.critical;
      }
      return b.gapCounts.partial - a.gapCounts.partial;
    });
  },

  /** Mock-based fallback implementation for legacy/mock event IDs */
  async _mockGetGapsGroupedBySector(eventId: string): Promise<SectorWithGaps[]> {
    await simulateDelay(150);
    const visibleGaps = await this.getVisibleGapsForEvent(eventId);
    
    // Group gaps by sector_id
    const gapsBySector: Record<string, GapWithDetails[]> = {};
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
        need_status: gap.need_status ?? mapGapStateToNeedStatus(gap.state),
      }));
      
      // Get signal types for each gap
      const gapSignalTypes: Record<string, SignalType[]> = {};
      gaps.forEach(gap => {
        gapSignalTypes[gap.id] = getDominantSignalTypesForGap(gap.sector_id, gap.capacity_type_id);
      });
      
      const criticalCount = gapsWithDetails.filter(g => g.need_status === 'RED').length;
      const partialCount = gapsWithDetails.filter(g => g.need_status === 'ORANGE').length;
      
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
   * Get counts for metrics cards.
   * Queries Supabase for real events; falls back to mock for legacy mock event IDs.
   */
  async getCounts(eventId: string): Promise<GapCounts> {
    const { data: needs } = await supabase
      .from("sector_needs_context")
      .select("level")
      .eq("event_id", eventId);

    if (needs && needs.length > 0) {
      // "critical" and "high" both map to RED (GapState "critical") via mapNeedLevelToGapState
      const critical = needs.filter((n) => ["critical", "high"].includes(n.level)).length;
      const partial = needs.filter((n) => n.level === "medium").length;
      const active = needs.filter((n) => n.level === "low").length;

      const { data: dbSectors } = await supabase
        .from("sectors")
        .select("id")
        .eq("event_id", eventId);
      const sectorsWithGaps = dbSectors ? dbSectors.length : 0;

      return { critical, partial, active, evaluating: 0, sectorsWithGaps };
    }

    // Fallback to mock data for legacy/mock event IDs
    return this._mockGetCounts(eventId);
  },

  async _mockGetCounts(eventId: string): Promise<GapCounts> {
    await simulateDelay(100);
    const counts = countGapsByState(eventId);
    const sectorsWithGaps = getSectorsWithGapsFromData(eventId).length;
    return { ...counts, sectorsWithGaps };
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

  /**
   * Get enriched sector by ID for Admin Dashboard detail drawer
   * Unlike the ONG version, this shows ALL gaps (not filtered by actor capabilities)
   */
  async getEnrichedSectorById(sectorId: string): Promise<EnrichedSector | null> {
    await simulateDelay(150);
    
    const sector = getSectorById(sectorId);
    if (!sector) return null;
    
    const event = getEventById(sector.event_id);
    if (!event) return null;
    
    const context = MOCK_SECTOR_CONTEXT[sectorId] || {
      keyPoints: ["Sin información adicional"],
      extendedContext: "No hay contexto disponible para este sector.",
      operationalSummary: "Sector sin evaluación detallada.",
    };
    
    // Build gaps from capability matrix
    const matrix = MOCK_SECTOR_CAPABILITY_MATRIX[sectorId] || {};
    const gaps: SectorGap[] = [];
    
    MOCK_CAPACITY_TYPES.forEach(capacity => {
      const level = matrix[capacity.id] as NeedLevelExtended || "unknown";
      if (level === "unknown" || level === "covered") return;
      
      const deployments = MOCK_DEPLOYMENTS.filter(
        d => d.sector_id === sectorId && 
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
    
    const hasCritical = gaps.some(g => g.isCritical);
    const state: EnrichedSector["state"] = hasCritical ? "critical" : "partial";
    
    const actorsInSector = getActorsInSector(sectorId);
    const recentSignals = getSignalsBySector(sectorId).slice(0, 5);
    
    return {
      sector,
      event,
      state,
      context,
      gaps,
      relevantGaps: gaps, // Admin sees all gaps as relevant
      bestMatchGaps: gaps.slice(0, 2),
      actorsInSector,
      recentSignals,
    };
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

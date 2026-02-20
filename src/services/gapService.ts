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
import { computeSectorSeverity, type NeedCriticalityLevel } from "@/lib/sectorNeedAggregation";
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
  sector_need_status?: NeedStatus;
  sector_need_score?: number;
  sector_high_uncertainty?: boolean;
  sector_override_reasons?: string[];
}

function inferNeedCriticality(gap: GapWithDetails): NeedCriticalityLevel {
  return gap.capacity_type?.criticality_level ?? "medium";
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

/**
 * Adjust the NeedStatus for a given need level based on active deployment
 * coverage.  When actors are confirmed/operating for a sector+capability the
 * status should improve:
 *   critical/high  – RED  → ORANGE  (has some coverage, still insufficient)
 *   medium         – ORANGE → YELLOW (coverage in validation)
 *   low            – GREEN  (unchanged)
 */
/** Minimal shape returned by the deployments query used for coverage counting. */
type DeploymentRow = { sector_id: string; capacity_type_id: string };

/** Build a lookup map of "sectorId:capacityTypeId" → deployment count. */
function buildDeploymentCountMap(rows: DeploymentRow[]): Map<string, number> {
  const map = new Map<string, number>();
  rows.forEach((d) => {
    const key = `${d.sector_id}:${d.capacity_type_id}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  });
  return map;
}

export function adjustStatusForCoverage(
  level: string,
  activeDeploymentCount: number,
  interestedDeploymentCount: number = 0,
): { state: GapState; needStatus: NeedStatus } {
  const baseState = mapNeedLevelToGapState(level);
  const baseStatus = mapGapStateToNeedStatus(baseState);

  // Confirmed/operating deployments provide stronger coverage signal
  if (activeDeploymentCount > 0) {
    switch (level) {
      case "critical":
      case "high":
        return { state: "partial" as GapState, needStatus: "ORANGE" as NeedStatus };
      case "medium":
        return { state: "partial" as GapState, needStatus: "YELLOW" as NeedStatus };
      case "low":
      default:
        return { state: baseState, needStatus: baseStatus };
    }
  }

  // Interested-only deployments: coverage is being validated (RED → YELLOW)
  if (interestedDeploymentCount > 0) {
    switch (level) {
      case "critical":
      case "high":
        return { state: "partial" as GapState, needStatus: "YELLOW" as NeedStatus };
      case "medium":
        return { state: "partial" as GapState, needStatus: "YELLOW" as NeedStatus };
      case "low":
      default:
        return { state: baseState, needStatus: baseStatus };
    }
  }

  return { state: baseState, needStatus: baseStatus };
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

    // Fetch deployments (interested / confirmed / operating) for coverage adjustment
    const { data: deployments } = await supabase
      .from("deployments")
      .select("sector_id, capacity_type_id, status")
      .eq("event_id", eventId)
      .in("status", ["interested", "confirmed", "operating"]);

    const allDeps = (deployments ?? []) as (DeploymentRow & { status: string })[];
    // Build separate lookups: active (confirmed/operating) vs interested-only
    const activeDeps = allDeps.filter((d) => d.status === "confirmed" || d.status === "operating");
    const interestedDeps = allDeps.filter((d) => d.status === "interested");
    const deploymentCounts = buildDeploymentCountMap(activeDeps);
    const interestedCounts = buildDeploymentCountMap(interestedDeps);

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
        const key = `${need.sector_id}:${need.capacity_type_id}`;
        const activeCount = deploymentCounts.get(key) ?? 0;
        const interestedCount = interestedCounts.get(key) ?? 0;
        const { state, needStatus } = adjustStatusForCoverage(need.level, activeCount, interestedCount);
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
      
      const criticalCount = gaps.filter(g => g.state === 'critical').length;
      const partialCount = gaps.filter(g => g.state === 'partial').length;

      const sectorPopulation = Math.max(1, sector?.population_affected ?? 1);
      const sectorAgg = computeSectorSeverity(
        gapsWithDetails.map((gap) => ({
          need_id: gap.id,
          need_status: gap.need_status ?? mapGapStateToNeedStatus(gap.state),
          criticality_level: inferNeedCriticality(gap),
          population_weight: sectorPopulation,
        })),
      );
      
      return {
        sector: sector!,
        context,
        gaps: gapsWithDetails,
        hasCritical: criticalCount > 0,
        gapCounts: { critical: criticalCount, partial: partialCount },
        gapSignalTypes,
        sector_need_status: sectorAgg.status,
        sector_need_score: sectorAgg.score,
        sector_high_uncertainty: sectorAgg.high_uncertainty,
        sector_override_reasons: sectorAgg.override_reasons,
      };
    });
    
    // Sort by computed sector severity first, then fallback to legacy counters
    return sectorsWithGaps.sort((a, b) => {
      const scoreA = a.sector_need_score ?? 0;
      const scoreB = b.sector_need_score ?? 0;
      if (scoreA !== scoreB) return scoreB - scoreA;

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
      .select("level, sector_id, capacity_type_id")
      .eq("event_id", eventId);

    if (needs && needs.length > 0) {
      // Fetch deployments for coverage adjustment (interested + confirmed + operating)
      const { data: deployments } = await supabase
        .from("deployments")
        .select("sector_id, capacity_type_id, status")
        .eq("event_id", eventId)
        .in("status", ["interested", "confirmed", "operating"]);

      const allDeps = (deployments ?? []) as (DeploymentRow & { status: string })[];
      const activeDeps = allDeps.filter((d) => d.status === "confirmed" || d.status === "operating");
      const interestedDeps = allDeps.filter((d) => d.status === "interested");
      const deploymentCounts = buildDeploymentCountMap(activeDeps);
      const interestedCounts = buildDeploymentCountMap(interestedDeps);

      let critical = 0;
      let partial = 0;
      let active = 0;

      for (const n of needs) {
        const key = `${n.sector_id}:${n.capacity_type_id}`;
        const count = deploymentCounts.get(key) ?? 0;
        const interested = interestedCounts.get(key) ?? 0;
        const { needStatus } = adjustStatusForCoverage(n.level, count, interested);
        switch (needStatus) {
          case "RED":
            critical++;
            break;
          case "ORANGE":
            partial++;
            break;
          case "YELLOW":
          case "GREEN":
            active++;
            break;
          // WHITE / default ignored
        }
      }

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

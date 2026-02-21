import { supabase } from "@/integrations/supabase/client";
import type { SectorContext } from "./deploymentService";
import { getGapStateConfig } from "@/lib/stateTransitions";
import { mapGapStateToNeedStatus, NEED_STATUS_ORDER, type NeedStatus } from "@/lib/needStatus";
import { computeSectorSeverity, type NeedCriticalityLevel } from "@/lib/sectorNeedAggregation";
import type { NeedLevelExtended } from "./matrixService";
import type { Gap, GapState, Signal, Deployment, Sector, CapacityType, Event, SignalType, SectorGap, NeedLevel } from "@/types/database";
import type { EnrichedSector } from "./sectorService";

export interface GapWithDetails extends Gap {
  sector?: Sector;
  capacity_type?: CapacityType;
  event?: Event;
  signals?: Signal[];
  coverage?: Deployment[];
  need_status?: NeedStatus;
  actor_count?: number;
  operational_requirements?: string[];
  reasoning_summary?: string;
  trend?: "improving" | "worsening" | "stable" | null;
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

type Trend = "improving" | "worsening" | "stable";

const STATUS_RANK: Record<string, number> = {
  GREEN: 0, WHITE: 1, YELLOW: 2, ORANGE: 3, RED: 4,
};

function deriveTrend(auditRows: Array<{ previous_status: string; final_status: string }>): Trend | null {
  const latest = auditRows[0];
  if (!latest) return null;
  if (latest.previous_status === latest.final_status) return "stable";
  const prevRank = STATUS_RANK[latest.previous_status] ?? 0;
  const finalRank = STATUS_RANK[latest.final_status] ?? 0;
  if (finalRank < prevRank) return "improving";
  if (finalRank > prevRank) return "worsening";
  return "stable";
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

/**
 * Map a DB need level directly to a display state and NeedStatus.
 * The engine's output in sector_needs_context.level is the single source of truth.
 */
export function mapNeedLevelToStatus(level: string): { state: GapState; needStatus: NeedStatus } {
  switch (level) {
    case "critical":
      return { state: "critical", needStatus: "RED" };
    case "high":
      return { state: "critical", needStatus: "ORANGE" };
    case "medium":
      return { state: "partial", needStatus: "YELLOW" };
    case "low":
      return { state: "active", needStatus: "GREEN" };
    default:
      return { state: "evaluating", needStatus: "WHITE" };
  }
}

export const gapService = {
  /**
   * Get gaps grouped by sector for admin dashboard.
   * Queries Supabase; returns empty array when no sectors exist in DB.
   */
  async getGapsGroupedBySector(eventId: string): Promise<SectorWithGaps[]> {
    // Try to fetch real sectors from DB
    const { data: dbSectors, error: sectorsError } = await supabase
      .from("sectors")
      .select("*")
      .eq("event_id", eventId);

    if (sectorsError || !dbSectors || dbSectors.length === 0) {
      return [];
    }

    // Fetch sector_needs_context for this event, joined with capacity_types
    const { data: needs } = await supabase
      .from("sector_needs_context")
      .select("*, capacity_types(*)")
      .eq("event_id", eventId);

    // Fetch latest need_audits rows for each (sector_id, capability_id) in this event
    const sectorIds = dbSectors.map((s) => s.id);
    const { data: auditRows } = await supabase
      .from("need_audits")
      .select("sector_id, capability_id, reasoning_summary, previous_status, final_status, timestamp")
      .in("sector_id", sectorIds)
      .order("timestamp", { ascending: false });

    // Build a map of "sector_id:capability_id" → latest reasoning_summary
    // and group rows by key for trend computation
    const auditMap = new Map<string, string>();
    const auditsByKey = new Map<string, typeof auditRows[0][]>();
    (auditRows ?? []).forEach((row) => {
      const key = `${row.sector_id}:${row.capability_id}`;
      if (!auditMap.has(key) && row.reasoning_summary) {
        auditMap.set(key, row.reasoning_summary);
      }
      if (!auditsByKey.has(key)) auditsByKey.set(key, []);
      auditsByKey.get(key)!.push(row);
    });
    const latestAuditTimestamp = new Map<string, string>();
    auditsByKey.forEach((rows, key) => {
      if (rows[0]?.timestamp) latestAuditTimestamp.set(key, rows[0].timestamp);
    });

    const trendMap = new Map<string, Trend>();
    auditsByKey.forEach((rows, key) => {
      const trend = deriveTrend(rows);
      if (trend !== null) trendMap.set(key, trend);
    });

    // Fetch deployment counts grouped by sector_id + capacity_type_id
    const { data: deploymentRows } = await supabase
      .from("deployments")
      .select("sector_id, capacity_type_id")
      .eq("event_id", eventId)
      .in("status", ["interested", "confirmed", "operating"]);

    // Build a map of "sector_id:capacity_type_id" → count
    const deploymentCounts = new Map<string, number>();
    (deploymentRows ?? []).forEach((d) => {
      const key = `${d.sector_id}:${d.capacity_type_id}`;
      deploymentCounts.set(key, (deploymentCounts.get(key) ?? 0) + 1);
    });

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
        const { state, needStatus } = mapNeedLevelToStatus(need.level);
        return {
          id: need.id,
          event_id: need.event_id,
          sector_id: need.sector_id,
          capacity_type_id: need.capacity_type_id,
          state,
          last_updated_at: latestAuditTimestamp.get(`${need.sector_id}:${need.capacity_type_id}`) ?? need.created_at,
          signal_count: 0,
          sector,
          capacity_type: need.capacity_types ?? undefined,
          need_status: needStatus,
          actor_count: deploymentCounts.get(`${need.sector_id}:${need.capacity_type_id}`) ?? 0,
          operational_requirements: (() => {
            if (!need.notes) return [];
            try {
              const parsed = JSON.parse(need.notes);
              if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                return Array.isArray(parsed.requirements) ? parsed.requirements : [];
              }
              if (Array.isArray(parsed)) return parsed; // legacy
              return [];
            } catch { return []; }
          })(),
          reasoning_summary: (() => {
            if (need.notes) {
              try {
                const parsed = JSON.parse(need.notes);
                if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && typeof parsed.description === "string") {
                  return parsed.description;
                }
              } catch {
                return need.notes; // legacy plain text
              }
            }
            return auditMap.get(`${need.sector_id}:${need.capacity_type_id}`);
          })(),
          trend: trendMap.get(`${need.sector_id}:${need.capacity_type_id}`) ?? null,
        };
      });

      const criticalCount = gapsWithDetails.filter((g) => g.need_status === "RED").length;
      const partialCount = gapsWithDetails.filter((g) => g.need_status === "ORANGE").length;

      const sectorAgg = computeSectorSeverity(
        gapsWithDetails.map((gap) => ({
          need_id: gap.id,
          need_status: gap.need_status ?? mapGapStateToNeedStatus(gap.state),
          criticality_level: inferNeedCriticality(gap),
          population_weight: 1,
        })),
      );

      result.push({
        sector,
        context: { keyPoints: [], extendedContext: "", operationalSummary: "" },
        gaps: gapsWithDetails,
        hasCritical: criticalCount > 0,
        gapCounts: { critical: criticalCount, partial: partialCount },
        gapSignalTypes: {},
        sector_need_status: sectorAgg.status,
        sector_need_score: sectorAgg.score,
        sector_high_uncertainty: sectorAgg.high_uncertainty,
        sector_override_reasons: sectorAgg.override_reasons,
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

  /**
   * Get signals for a specific gap
   */
  async getSignalsForGap(sectorId: string, _capacityTypeId: string): Promise<Signal[]> {
    const { data } = await supabase
      .from("signals")
      .select("*")
      .eq("sector_id", sectorId)
      .order("created_at", { ascending: false })
      .limit(20);
    return (data ?? []) as Signal[];
  },

  /**
   * Get counts for metrics cards.
   * Queries Supabase for real events.
   */
  async getCounts(eventId: string): Promise<GapCounts> {
    const { data: needs } = await supabase
      .from("sector_needs_context")
      .select("level, sector_id, capacity_type_id")
      .eq("event_id", eventId);

    if (!needs || needs.length === 0) {
      return { critical: 0, partial: 0, active: 0, evaluating: 0, sectorsWithGaps: 0 };
    }

    let critical = 0;
    let partial = 0;
    let active = 0;

    for (const n of needs) {
      switch (n.level) {
        case "critical":
          critical++;
          break;
        case "high":
          partial++;
          break;
        case "medium":
        case "low":
          active++;
          break;
        // default (unknown / covered) ignored
      }
    }

    const { data: dbSectors } = await supabase
      .from("sectors")
      .select("id")
      .eq("event_id", eventId);
    const sectorsWithGaps = dbSectors ? dbSectors.length : 0;

    return { critical, partial, active, evaluating: 0, sectorsWithGaps };
  },

  /**
   * Get dashboard meta info (last signal, global confidence, operating count).
   */
  async getDashboardMeta(eventId: string): Promise<DashboardMeta> {
    const [signalResult, deploymentResult] = await Promise.all([
      supabase
        .from("signals")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("deployments")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId)
        .in("status", ["operating", "confirmed"]),
    ]);

    const lastSignal = signalResult.data as Signal | null;
    const operatingCount = deploymentResult.count ?? 0;

    // Derive confidence from recency of last signal
    let globalConfidence: "high" | "medium" | "low" = "medium";
    if (lastSignal) {
      const ageHours = (Date.now() - new Date(lastSignal.created_at).getTime()) / 3600000;
      if (ageHours < 1) globalConfidence = "high";
      else if (ageHours > 6) globalConfidence = "low";
    } else {
      globalConfidence = "low";
    }

    return { lastSignal, globalConfidence, operatingCount };
  },

  /**
   * Get operating actors for modal
   */
  async getOperatingActors(eventId: string): Promise<OperatingActor[]> {
    const { data: deps } = await supabase
      .from("deployments")
      .select("actor_id, sector_id, capacity_type_id, status, updated_at, capacity_types(name)")
      .eq("event_id", eventId)
      .in("status", ["operating", "confirmed"]);

    if (!deps || deps.length === 0) return [];

    const actorIds = [...new Set(deps.map((d) => d.actor_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, organization_name, organization_type, phone")
      .in("user_id", actorIds);

    type ProfileRow = {
      user_id: string;
      full_name: string | null;
      organization_name: string | null;
      organization_type: string | null;
      phone: string | null;
    };

    const profileMap = new Map<string, ProfileRow>();
    (profiles ?? []).forEach((p) => profileMap.set(p.user_id, p as ProfileRow));

    // Group deployments by actor
    const byActor = new Map<string, typeof deps>();
    deps.forEach((d) => {
      if (!byActor.has(d.actor_id)) byActor.set(d.actor_id, []);
      byActor.get(d.actor_id)!.push(d);
    });

    return Array.from(byActor.entries()).map(([actorId, actorDeps]) => {
      const profile = profileMap.get(actorId);
      const lastDep = actorDeps.sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      )[0];
      type CapType = { name: string };
      const capName = (lastDep.capacity_types as CapType | null)?.name ?? "Capacidad";

      return {
        id: actorId,
        name: profile?.organization_name ?? profile?.full_name ?? actorId,
        type: (profile?.organization_type as OperatingActor["type"]) ?? "ong",
        sectors: [...new Set(actorDeps.map((d) => d.sector_id))],
        capacity: capName,
        lastConfirmation: lastDep.updated_at ?? null,
        contact: profile?.phone ? { name: profile.full_name ?? "", phone: profile.phone } : undefined,
      };
    });
  },

  /**
   * Get sectors that have visible gaps (distinct sector IDs from sector_needs_context)
   */
  async getSectorsWithGaps(eventId: string): Promise<string[]> {
    const { data } = await supabase
      .from("sector_needs_context")
      .select("sector_id")
      .eq("event_id", eventId);
    return [...new Set((data ?? []).map((r) => r.sector_id))];
  },

  /**
   * Get evaluating gaps count (for collapsed section)
   */
  async getEvaluatingCount(_eventId: string): Promise<number> {
    return 0;
  },

  /**
   * Get enriched sector by ID for Admin Dashboard detail drawer.
   * Unlike the ONG version, this shows ALL gaps (not filtered by actor capabilities).
   */
  async getEnrichedSectorById(sectorId: string): Promise<EnrichedSector | null> {
    const { data: sectorData } = await supabase
      .from("sectors")
      .select("*")
      .eq("id", sectorId)
      .maybeSingle();
    if (!sectorData) return null;
    const sector = sectorData as unknown as Sector;

    const { data: eventData } = await supabase
      .from("events")
      .select("*")
      .eq("id", sector.event_id)
      .maybeSingle();
    if (!eventData) return null;
    const event = eventData as unknown as Event;

    const { data: needsData } = await supabase
      .from("sector_needs_context")
      .select("*, capacity_types(*)")
      .eq("sector_id", sectorId);

    const { data: deploymentsData } = await supabase
      .from("deployments")
      .select("*, profiles(user_id, full_name, organization_name)")
      .eq("sector_id", sectorId)
      .in("status", ["operating", "confirmed"]);

    const { data: signalsData } = await supabase
      .from("signals")
      .select("*")
      .eq("sector_id", sectorId)
      .order("created_at", { ascending: false })
      .limit(5);

    type DeploymentRow = {
      capacity_type_id: string;
      actor_id: string;
      status: string;
      profiles: { user_id: string; full_name: string | null; organization_name: string | null } | null;
    };
    const deployments = (deploymentsData ?? []) as unknown as DeploymentRow[];
    const gaps: SectorGap[] = [];
    const resolvedGaps: SectorGap[] = [];

    type NeedRow = {
      capacity_type_id: string;
      level: string;
      capacity_types: CapacityType | null;
    };
    const needs = (needsData ?? []) as NeedRow[];

    for (const need of needs) {
      const capType = need.capacity_types;
      if (!capType) continue;

      const level = need.level as NeedLevelExtended;
      if (level === "unknown") continue;

      const matchingDeployments = deployments.filter((d) => d.capacity_type_id === need.capacity_type_id);
      const coveringActors = matchingDeployments.map((d) => ({
        name: d.profiles?.organization_name ?? d.profiles?.full_name ?? "Actor desconocido",
        status: d.status,
      }));

      if (level === "covered") {
        resolvedGaps.push({
          sector,
          capacityType: capType,
          smsDemand: 0,
          contextDemand: 0,
          totalDemand: 0,
          coverage: matchingDeployments.length,
          gap: 0,
          isUncovered: false,
          isCritical: false,
          maxLevel: "low" as NeedLevel,
          coveringActors,
        });
        continue;
      }

      const coverage = matchingDeployments.length;
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
          maxLevel: level as NeedLevel,
          coveringActors,
        });
      }
    }

    const hasCritical = gaps.some((g) => g.isCritical);
    const state: EnrichedSector["state"] = hasCritical ? "critical" : gaps.length > 0 ? "partial" : "contained";

    const context = {
      keyPoints: [],
      extendedContext: "",
      operationalSummary: "",
    };

    return {
      sector,
      event,
      state,
      context,
      gaps,
      relevantGaps: gaps,
      bestMatchGaps: gaps.slice(0, 2),
      actorsInSector: [],
      recentSignals: (signalsData ?? []) as Signal[],
      resolvedGaps,
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

import { supabase } from "@/integrations/supabase/client";
import type { Deployment, DeploymentStatus, Event, Sector, CapacityType } from "@/types/database";
import { needSignalService } from "@/services/needSignalService";

export interface DeploymentWithDetails extends Deployment {
  event?: Event;
  sector?: Sector;
  capacity_type?: CapacityType;
}

export type OperatingPhase = "preparing" | "operating" | "stabilizing";
export type SectorState = "critical" | "partial" | "contained";

export interface ActorInSector {
  id: string;
  name: string;
  role: string;
  capacity: string;
  status: DeploymentStatus;
}

export interface SectorContext {
  keyPoints: string[];
  extendedContext: string;
  operationalSummary: string;
}

export interface SectorDeploymentGroup {
  sector: Sector;
  event: Event;
  sectorState: SectorState;
  sectorContext: SectorContext;
  deployments: DeploymentWithDetails[];
  operatingPhase: OperatingPhase;
  otherActors: ActorInSector[];
}

async function determineSectorState(sectorId: string): Promise<SectorState> {
  const { data: needs } = await supabase
    .from("sector_needs_context")
    .select("level")
    .eq("sector_id", sectorId);

  if (!needs || needs.length === 0) return "partial";

  const levels = needs.map((n) => n.level);
  if (levels.includes("critical")) return "critical";
  if (levels.every((v) => v === "low")) return "contained";
  return "partial";
}

function determineOperatingPhase(
  deployments: DeploymentWithDetails[],
  sectorState: SectorState,
): OperatingPhase {
  const hasOperating = deployments.some((d) => d.status === "operating");
  const allOperating = deployments.every((d) => d.status === "operating");

  if (hasOperating && allOperating && sectorState === "contained") {
    return "stabilizing";
  }
  if (hasOperating) return "operating";
  return "preparing";
}

function sortSectorGroups(groups: SectorDeploymentGroup[]): SectorDeploymentGroup[] {
  const phaseOrder: Record<OperatingPhase, number> = { operating: 0, preparing: 1, stabilizing: 2 };
  const stateOrder: Record<SectorState, number> = { critical: 0, partial: 1, contained: 2 };

  return groups.sort((a, b) => {
    if (phaseOrder[a.operatingPhase] !== phaseOrder[b.operatingPhase])
      return phaseOrder[a.operatingPhase] - phaseOrder[b.operatingPhase];
    if (stateOrder[a.sectorState] !== stateOrder[b.sectorState])
      return stateOrder[a.sectorState] - stateOrder[b.sectorState];
    const aLatest = Math.max(...a.deployments.map((d) => new Date(d.updated_at).getTime()));
    const bLatest = Math.max(...b.deployments.map((d) => new Date(d.updated_at).getTime()));
    return bLatest - aLatest;
  });
}

export const deploymentService = {
  async getMyDeployments(actorId: string): Promise<DeploymentWithDetails[]> {
    const { data, error } = await supabase
      .from("deployments")
      .select("*, events(*), sectors(*), capacity_types:capacity_type_id(*)") 
      .eq("actor_id", actorId);

    if (error) throw error;
    if (!data) return [];

    return data.map((d: any) => ({
      ...d,
      event: d.events ?? undefined,
      sector: d.sectors ?? undefined,
      capacity_type: d.capacity_types ?? undefined,
      events: undefined,
      sectors: undefined,
      capacity_types: undefined,
    }));
  },

  async getMyDeploymentsGrouped(actorId: string): Promise<SectorDeploymentGroup[]> {
    const deployments = await this.getMyDeployments(actorId);

    // Group by sector
    const sectorMap = new Map<string, DeploymentWithDetails[]>();
    deployments.forEach((d) => {
      const existing = sectorMap.get(d.sector_id) || [];
      existing.push(d);
      sectorMap.set(d.sector_id, existing);
    });

    const groups: SectorDeploymentGroup[] = [];

    for (const [sectorId, sectorDeployments] of sectorMap.entries()) {
      const sector = sectorDeployments[0]?.sector;
      const event = sectorDeployments[0]?.event;
      if (!sector || !event) continue;

      const sectorState = await determineSectorState(sectorId);
      const operatingPhase = determineOperatingPhase(sectorDeployments, sectorState);

      const sectorContext: SectorContext = {
        keyPoints: [],
        extendedContext: "",
        operationalSummary: `Sector ${sector.canonical_name} - ${event.name}`,
      };

      // Fetch other actors in this sector
      const { data: otherDeps } = await supabase
        .from("deployments")
        .select("id, status, actor_id, capacity_types:capacity_type_id(name), profiles:actor_id(full_name, organization_name)")
        .eq("sector_id", sectorId)
        .neq("actor_id", actorId);

      const otherActors: ActorInSector[] = (otherDeps || []).map((d: any) => ({
        id: d.actor_id,
        name: d.profiles?.full_name || d.profiles?.organization_name || "Actor",
        role: "actor",
        capacity: d.capacity_types?.name || "Sin especificar",
        status: d.status,
      }));

      groups.push({
        sector,
        event,
        sectorState,
        sectorContext,
        deployments: sectorDeployments,
        operatingPhase,
        otherActors,
      });
    }

    return sortSectorGroups(groups);
  },

  async enroll(
    actorId: string,
    eventId: string,
    sectorId: string,
    capacityTypeId: string,
    notes?: string,
  ): Promise<Deployment> {
    // Check for existing active deployment
    const { data: existing } = await supabase
      .from("deployments")
      .select("id")
      .eq("actor_id", actorId)
      .eq("sector_id", sectorId)
      .eq("capacity_type_id", capacityTypeId)
      .not("status", "eq", "finished")
      .limit(1);

    if (existing && existing.length > 0) {
      throw new Error("Ya estás inscrito en este sector con esta capacidad");
    }

    const { data, error } = await supabase
      .from("deployments")
      .insert({
        actor_id: actorId,
        event_id: eventId,
        sector_id: sectorId,
        capacity_type_id: capacityTypeId,
        status: "interested",
        notes: notes || null,
        verified: false,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateStatus(id: string, status: DeploymentStatus): Promise<void> {
    const { data: deployment, error: fetchError } = await supabase
      .from("deployments")
      .select("event_id, sector_id, capacity_type_id")
      .eq("id", id)
      .single();
    const { error } = await supabase
      .from("deployments")
      .update({ status })
      .eq("id", id);
    if (error) throw error;
    if (!fetchError && deployment) {
      needSignalService.onDeploymentStatusChange({
        eventId: deployment.event_id,
        sectorId: deployment.sector_id,
        capabilityId: deployment.capacity_type_id,
        deploymentStatus: status,
      }).catch(() => {/* best-effort */});
    }
  },

  async updateStatusWithNote(id: string, status: DeploymentStatus, notes?: string): Promise<void> {
    const { data: deployment, error: fetchError } = await supabase
      .from("deployments")
      .select("event_id, sector_id, capacity_type_id")
      .eq("id", id)
      .single();
    const update: any = { status };
    if (notes !== undefined) update.notes = notes;
    const { error } = await supabase
      .from("deployments")
      .update(update)
      .eq("id", id);
    if (error) throw error;
    if (!fetchError && deployment) {
      needSignalService.onDeploymentStatusChange({
        eventId: deployment.event_id,
        sectorId: deployment.sector_id,
        capabilityId: deployment.capacity_type_id,
        deploymentStatus: status,
      }).catch(() => {/* best-effort */});
    }
  },

  async markSectorAsOperating(sectorId: string, actorId: string): Promise<void> {
    const { error } = await supabase
      .from("deployments")
      .update({ status: "operating" as DeploymentStatus })
      .eq("sector_id", sectorId)
      .eq("actor_id", actorId)
      .in("status", ["interested", "confirmed"]);
    if (error) throw error;
  },

  async getActiveCount(): Promise<number> {
    const { count, error } = await supabase
      .from("deployments")
      .select("*", { count: "exact", head: true })
      .eq("status", "operating");
    if (error) throw error;
    return count ?? 0;
  },

  async getOperatingCount(eventId: string): Promise<number> {
    const { count, error } = await supabase
      .from("deployments")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("status", "operating");
    if (error) throw error;
    return count ?? 0;
  },

  async markAsOperating(
    id: string,
    feedbackType: "yes" | "insufficient" | "suspended",
    notes?: string,
  ): Promise<void> {
    const { data: deployment, error: fetchError } = await supabase
      .from("deployments")
      .select("event_id, sector_id, capacity_type_id")
      .eq("id", id)
      .single();
    let status: DeploymentStatus;
    switch (feedbackType) {
      case "yes":
      case "insufficient":
        status = "operating";
        break;
      case "suspended":
        status = "suspended";
        break;
    }
    const update: any = { status };
    if (notes) update.notes = notes;
    const { error } = await supabase
      .from("deployments")
      .update(update)
      .eq("id", id);
    if (error) throw error;
    if (!fetchError && deployment) {
      needSignalService.onDeploymentStatusChange({
        eventId: deployment.event_id,
        sectorId: deployment.sector_id,
        capabilityId: deployment.capacity_type_id,
        deploymentStatus: status,
      }).catch(() => {/* best-effort */});
    }
  },
};

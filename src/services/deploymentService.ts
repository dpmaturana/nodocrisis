import { supabase } from "@/integrations/supabase/client";
import type { Deployment, DeploymentStatus, Event, Sector, CapacityType } from "@/types/database";
import type { ActorInSector, SectorContext } from "./mock/data";

export interface DeploymentWithDetails extends Deployment {
  event?: Event;
  sector?: Sector;
  capacity_type?: CapacityType;
}

export type OperatingPhase = "preparing" | "operating" | "stabilizing";
export type SectorState = "critical" | "partial" | "contained";

// Re-export types for consumers
export type { ActorInSector, SectorContext };

export interface SectorDeploymentGroup {
  sector: Sector;
  event: Event;
  sectorState: SectorState;
  sectorContext: SectorContext;
  deployments: DeploymentWithDetails[];
  operatingPhase: OperatingPhase;
  otherActors: ActorInSector[];
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

function determineSectorState(needLevels: string[]): SectorState {
  if (needLevels.includes("critical")) return "critical";
  if (needLevels.every(v => v === "low" || v === "covered")) return "contained";
  return "partial";
}

function determineOperatingPhase(deployments: DeploymentWithDetails[], sectorState: SectorState): OperatingPhase {
  const hasOperating = deployments.some(d => d.status === "operating");
  const allOperating = deployments.every(d => d.status === "operating");
  
  if (hasOperating && allOperating && sectorState === "contained") {
    return "stabilizing";
  }
  if (hasOperating) {
    return "operating";
  }
  return "preparing";
}

function sortSectorGroups(groups: SectorDeploymentGroup[]): SectorDeploymentGroup[] {
  const phaseOrder: Record<OperatingPhase, number> = {
    operating: 0,
    preparing: 1,
    stabilizing: 2,
  };
  
  const stateOrder: Record<SectorState, number> = {
    critical: 0,
    partial: 1,
    contained: 2,
  };
  
  return groups.sort((a, b) => {
    if (phaseOrder[a.operatingPhase] !== phaseOrder[b.operatingPhase]) {
      return phaseOrder[a.operatingPhase] - phaseOrder[b.operatingPhase];
    }
    if (stateOrder[a.sectorState] !== stateOrder[b.sectorState]) {
      return stateOrder[a.sectorState] - stateOrder[b.sectorState];
    }
    const aLatest = Math.max(...a.deployments.map(d => new Date(d.updated_at).getTime()));
    const bLatest = Math.max(...b.deployments.map(d => new Date(d.updated_at).getTime()));
    return bLatest - aLatest;
  });
}

export const deploymentService = {
  async getMyDeployments(actorId: string): Promise<DeploymentWithDetails[]> {
    const { data, error } = await supabase
      .from("deployments")
      .select(`
        *,
        event:events(*),
        sector:sectors(*),
        capacity_type:capacity_types(*)
      `)
      .eq("actor_id", actorId);

    if (error) throw error;

    return (data || []).map((d: any) => ({
      ...d,
      event: d.event,
      sector: d.sector,
      capacity_type: d.capacity_type,
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
    
    // Get need levels for determining sector state
    const sectorIds = Array.from(sectorMap.keys());
    const { data: needsData } = await supabase
      .from("sector_needs_context")
      .select("sector_id, level")
      .in("sector_id", sectorIds);
    
    const needsBySector = new Map<string, string[]>();
    (needsData || []).forEach((n: any) => {
      const existing = needsBySector.get(n.sector_id) || [];
      existing.push(n.level);
      needsBySector.set(n.sector_id, existing);
    });
    
    // Get other actors in sectors
    const { data: otherDeployments } = await supabase
      .from("deployments")
      .select(`
        id,
        sector_id,
        status,
        actor_id,
        capacity_type:capacity_types(name),
        profile:profiles!deployments_actor_id_fkey(full_name, organization_name)
      `)
      .in("sector_id", sectorIds)
      .neq("actor_id", actorId);
    
    const otherActorsBySector = new Map<string, ActorInSector[]>();
    (otherDeployments || []).forEach((d: any) => {
      const existing = otherActorsBySector.get(d.sector_id) || [];
      existing.push({
        id: d.id,
        name: d.profile?.organization_name || d.profile?.full_name || "Actor",
        capacity: d.capacity_type?.name || "Capacidad",
        status: d.status,
      });
      otherActorsBySector.set(d.sector_id, existing);
    });
    
    // Build groups
    const groups: SectorDeploymentGroup[] = [];
    
    sectorMap.forEach((sectorDeployments, sectorId) => {
      const sector = sectorDeployments[0]?.sector;
      const event = sectorDeployments[0]?.event;
      
      if (!sector || !event) return;
      
      const needLevels = needsBySector.get(sectorId) || ["medium"];
      const sectorState = determineSectorState(needLevels);
      const operatingPhase = determineOperatingPhase(sectorDeployments, sectorState);
      
      groups.push({
        sector,
        event,
        sectorState,
        sectorContext: {
          keyPoints: [],
          extendedContext: "",
          operationalSummary: `Sector ${sector.canonical_name} - ${event.name}`,
        },
        deployments: sectorDeployments,
        operatingPhase,
        otherActors: otherActorsBySector.get(sectorId) || [],
      });
    });
    
    return sortSectorGroups(groups);
  },

  async enroll(
    actorId: string,
    eventId: string,
    sectorId: string,
    capacityTypeId: string,
    notes?: string
  ): Promise<Deployment> {
    // Check if already enrolled
    const { data: existing } = await supabase
      .from("deployments")
      .select("id")
      .eq("actor_id", actorId)
      .eq("sector_id", sectorId)
      .eq("capacity_type_id", capacityTypeId)
      .not("status", "eq", "finished")
      .single();
    
    if (existing) {
      throw new Error("Ya estás inscrito en este sector con esta capacidad");
    }
    
    const { data, error } = await supabase
      .from("deployments")
      .insert({
        event_id: eventId,
        sector_id: sectorId,
        capacity_type_id: capacityTypeId,
        actor_id: actorId,
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
    const { error } = await supabase
      .from("deployments")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    
    if (error) throw error;
  },

  async updateStatusWithNote(id: string, status: DeploymentStatus, notes?: string): Promise<void> {
    const updateData: any = { 
      status, 
      updated_at: new Date().toISOString() 
    };
    
    if (notes) {
      updateData.notes = notes;
    }
    
    const { error } = await supabase
      .from("deployments")
      .update(updateData)
      .eq("id", id);
    
    if (error) throw error;
  },

  async markSectorAsOperating(sectorId: string, actorId: string): Promise<void> {
    const { error } = await supabase
      .from("deployments")
      .update({ status: "operating", updated_at: new Date().toISOString() })
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
    return count || 0;
  },

  async getOperatingCount(eventId: string): Promise<number> {
    const { count, error } = await supabase
      .from("deployments")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("status", "operating");
    
    if (error) throw error;
    return count || 0;
  },

  async markAsOperating(
    id: string,
    feedbackType: "yes" | "insufficient" | "suspended",
    notes?: string
  ): Promise<void> {
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

    await this.updateStatusWithNote(id, status, notes);
  },
};

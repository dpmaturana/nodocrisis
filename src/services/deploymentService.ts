import { simulateDelay } from "./mock/delay";
import {
  getDeploymentsByActorId,
  addDeployment,
  updateDeploymentStatus,
  getEventById,
  getSectorById,
  getCapacityTypeById,
  getActorsInSector,
  MOCK_SECTOR_CAPABILITY_MATRIX,
  MOCK_SECTOR_CONTEXT,
  MOCK_DEPLOYMENTS,
  getOperatingCount as mockGetOperatingCount,
} from "./mock/data";
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

function determineSectorState(sectorId: string): SectorState {
  const matrix = MOCK_SECTOR_CAPABILITY_MATRIX[sectorId];
  if (!matrix) return "partial";
  
  const levels = Object.values(matrix);
  if (levels.includes("critical")) return "critical";
  if (levels.every(v => v === "low" || v === "covered")) return "contained";
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
    await simulateDelay(200);
    
    const deployments = getDeploymentsByActorId(actorId);
    
    return deployments.map(d => ({
      ...d,
      event: getEventById(d.event_id),
      sector: getSectorById(d.sector_id),
      capacity_type: getCapacityTypeById(d.capacity_type_id),
    }));
  },

  async getMyDeploymentsGrouped(actorId: string): Promise<SectorDeploymentGroup[]> {
    await simulateDelay(300);
    
    const deployments = await this.getMyDeployments(actorId);
    
    // Group by sector
    const sectorMap = new Map<string, DeploymentWithDetails[]>();
    
    deployments.forEach((d) => {
      const existing = sectorMap.get(d.sector_id) || [];
      existing.push(d);
      sectorMap.set(d.sector_id, existing);
    });
    
    // Build groups
    const groups: SectorDeploymentGroup[] = [];
    
    sectorMap.forEach((sectorDeployments, sectorId) => {
      const sector = sectorDeployments[0]?.sector;
      const event = sectorDeployments[0]?.event;
      
      if (!sector || !event) return;
      
      const sectorState = determineSectorState(sectorId);
      const operatingPhase = determineOperatingPhase(sectorDeployments, sectorState);
      const sectorContext = MOCK_SECTOR_CONTEXT[sectorId] || {
        keyPoints: [],
        extendedContext: "",
        operationalSummary: `Sector ${sector.canonical_name} - ${event.name}`,
      };
      
      groups.push({
        sector,
        event,
        sectorState,
        sectorContext,
        deployments: sectorDeployments,
        operatingPhase,
        otherActors: getActorsInSector(sectorId).filter(a => 
          !sectorDeployments.some(d => d.id === a.id)
        ),
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
    await simulateDelay(300);
    
    // Check if already enrolled
    const existing = MOCK_DEPLOYMENTS.find(
      d => d.actor_id === actorId && 
           d.sector_id === sectorId && 
           d.capacity_type_id === capacityTypeId &&
           d.status !== "finished"
    );
    
    if (existing) {
      throw new Error("Ya estás inscrito en este sector con esta capacidad");
    }
    
    return addDeployment({
      event_id: eventId,
      sector_id: sectorId,
      capacity_type_id: capacityTypeId,
      actor_id: actorId,
      status: "interested",
      notes: notes || null,
      verified: false,
    });
  },

  async updateStatus(id: string, status: DeploymentStatus): Promise<void> {
    await simulateDelay(200);
    updateDeploymentStatus(id, status);
  },

  async updateStatusWithNote(id: string, status: DeploymentStatus, notes?: string): Promise<void> {
    await simulateDelay(200);
    updateDeploymentStatus(id, status);
    // Notes are ignored in mock version
  },

  async markSectorAsOperating(sectorId: string, actorId: string): Promise<void> {
    await simulateDelay(200);
    
    MOCK_DEPLOYMENTS.forEach(d => {
      if (d.sector_id === sectorId && 
          d.actor_id === actorId && 
          (d.status === "interested" || d.status === "confirmed")) {
        d.status = "operating";
        d.updated_at = new Date().toISOString();
      }
    });
  },

  async getActiveCount(): Promise<number> {
    await simulateDelay(100);
    return MOCK_DEPLOYMENTS.filter(d => d.status === "operating").length;
  },

  async getOperatingCount(eventId: string): Promise<number> {
    await simulateDelay(100);
    return mockGetOperatingCount(eventId);
  },

  async markAsOperating(
    id: string,
    feedbackType: "yes" | "insufficient" | "suspended",
    notes?: string
  ): Promise<void> {
    await simulateDelay(200);
    
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

    updateDeploymentStatus(id, status);
  },
};

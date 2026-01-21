import { simulateDelay } from "./mock/delay";
import {
  MOCK_DEPLOYMENTS,
  getDeploymentsByActorId,
  addDeployment,
  updateDeploymentStatus as mockUpdateDeploymentStatus,
  getEventById,
  getSectorById,
  getCapacityTypeById,
  getActorsInSector,
  MOCK_SECTOR_CONTEXT,
  MOCK_SECTOR_CAPABILITY_MATRIX,
  type SectorContext,
  type ActorInSector,
} from "./mock/data";
import type { Deployment, DeploymentStatus, Event, Sector, CapacityType, GapState } from "@/types/database";

export interface DeploymentWithDetails extends Deployment {
  event?: Event;
  sector?: Sector;
  capacity_type?: CapacityType;
}

export type OperatingPhase = "preparing" | "operating" | "stabilizing";
export type SectorState = "critical" | "partial" | "contained";

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
  
  const values = Object.values(matrix);
  const hasCritical = values.includes("critical");
  const hasHigh = values.includes("high");
  const allCoveredOrLow = values.every(v => v === "covered" || v === "low" || v === "unknown");
  
  if (hasCritical) return "critical";
  if (allCoveredOrLow) return "contained";
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
    // 1. By operating phase
    if (phaseOrder[a.operatingPhase] !== phaseOrder[b.operatingPhase]) {
      return phaseOrder[a.operatingPhase] - phaseOrder[b.operatingPhase];
    }
    // 2. By sector state (critical first)
    if (stateOrder[a.sectorState] !== stateOrder[b.sectorState]) {
      return stateOrder[a.sectorState] - stateOrder[b.sectorState];
    }
    // 3. By most recent update
    const aLatest = Math.max(...a.deployments.map(d => new Date(d.updated_at).getTime()));
    const bLatest = Math.max(...b.deployments.map(d => new Date(d.updated_at).getTime()));
    return bLatest - aLatest;
  });
}

export const deploymentService = {
  async getMyDeployments(actorId: string): Promise<DeploymentWithDetails[]> {
    await simulateDelay(200);
    
    const deployments = getDeploymentsByActorId(actorId);
    
    return deployments.map((d) => ({
      ...d,
      event: getEventById(d.event_id),
      sector: getSectorById(d.sector_id),
      capacity_type: getCapacityTypeById(d.capacity_type_id),
    }));
  },

  async getMyDeploymentsGrouped(actorId: string): Promise<SectorDeploymentGroup[]> {
    await simulateDelay(200);
    
    const deployments = getDeploymentsByActorId(actorId);
    
    // Group by sector
    const sectorMap = new Map<string, DeploymentWithDetails[]>();
    
    deployments.forEach((d) => {
      const withDetails: DeploymentWithDetails = {
        ...d,
        event: getEventById(d.event_id),
        sector: getSectorById(d.sector_id),
        capacity_type: getCapacityTypeById(d.capacity_type_id),
      };
      
      const existing = sectorMap.get(d.sector_id) || [];
      existing.push(withDetails);
      sectorMap.set(d.sector_id, existing);
    });
    
    // Build groups
    const groups: SectorDeploymentGroup[] = [];
    
    sectorMap.forEach((sectorDeployments, sectorId) => {
      const sector = getSectorById(sectorId);
      const event = sectorDeployments[0]?.event;
      
      if (!sector || !event) return;
      
      const sectorState = determineSectorState(sectorId);
      const operatingPhase = determineOperatingPhase(sectorDeployments, sectorState);
      
      // Get other actors (exclude current actor)
      const allActors = getActorsInSector(sectorId);
      const otherActors = allActors.filter(a => 
        !sectorDeployments.some(d => d.id === a.id)
      );
      
      groups.push({
        sector,
        event,
        sectorState,
        sectorContext: MOCK_SECTOR_CONTEXT[sectorId] || {
          keyPoints: [],
          extendedContext: "",
          operationalSummary: "Sin información disponible",
        },
        deployments: sectorDeployments,
        operatingPhase,
        otherActors,
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
    mockUpdateDeploymentStatus(id, status);
  },

  async updateStatusWithNote(id: string, status: DeploymentStatus, notes?: string): Promise<void> {
    await simulateDelay(200);
    mockUpdateDeploymentStatus(id, status);
    
    if (notes) {
      const deployment = MOCK_DEPLOYMENTS.find(d => d.id === id);
      if (deployment) {
        deployment.notes = notes;
      }
    }
  },

  async markSectorAsOperating(sectorId: string, actorId: string): Promise<void> {
    await simulateDelay(200);
    
    // Update all deployments for this actor in this sector to operating
    MOCK_DEPLOYMENTS.forEach(d => {
      if (d.sector_id === sectorId && d.actor_id === actorId && 
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
    return MOCK_DEPLOYMENTS.filter(
      d => d.event_id === eventId && d.status === "operating"
    ).length;
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

    mockUpdateDeploymentStatus(id, status);
    
    // Update notes if provided
    if (notes) {
      const deployment = MOCK_DEPLOYMENTS.find(d => d.id === id);
      if (deployment) {
        deployment.notes = notes;
      }
    }
  },
};

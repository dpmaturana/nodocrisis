import { simulateDelay } from "./mock/delay";
import {
  MOCK_DEPLOYMENTS,
  getDeploymentsByActorId,
  addDeployment,
  updateDeploymentStatus as mockUpdateDeploymentStatus,
  getEventById,
  getSectorById,
  getCapacityTypeById,
} from "./mock/data";
import type { Deployment, DeploymentStatus, Event, Sector, CapacityType } from "@/types/database";

export interface DeploymentWithDetails extends Deployment {
  event?: Event;
  sector?: Sector;
  capacity_type?: CapacityType;
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

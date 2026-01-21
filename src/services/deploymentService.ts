import { simulateDelay } from "./mock/delay";
import { 
  MOCK_DEPLOYMENTS,
  MOCK_EVENTS,
  MOCK_SECTORS,
  MOCK_CAPACITY_TYPES,
  getDeploymentsByActorId,
  getEventById,
  getSectorById,
  getCapacityTypeById,
  addDeployment,
  updateDeploymentStatus,
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
    
    return deployments.map(d => ({
      ...d,
      event: getEventById(d.event_id),
      sector: getSectorById(d.sector_id),
      capacity_type: getCapacityTypeById(d.capacity_type_id),
    })).sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },

  async enroll(
    actorId: string,
    eventId: string,
    sectorId: string,
    capacityTypeId: string,
    notes?: string
  ): Promise<Deployment> {
    await simulateDelay(300);
    return addDeployment({
      event_id: eventId,
      sector_id: sectorId,
      capacity_type_id: capacityTypeId,
      actor_id: actorId,
      status: "planned",
      notes: notes || null,
      verified: false,
    });
  },

  async updateStatus(id: string, status: DeploymentStatus): Promise<void> {
    await simulateDelay(200);
    updateDeploymentStatus(id, status);
  },

  async getActiveCount(): Promise<number> {
    await simulateDelay(100);
    return MOCK_DEPLOYMENTS.filter(d => d.status === "active").length;
  },
};

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
      status: "interested", // PRD: starts as interested
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
    // PRD: count "operating" status instead of legacy "active"
    return MOCK_DEPLOYMENTS.filter(d => d.status === "operating").length;
  },

  async getOperatingCount(eventId: string): Promise<number> {
    await simulateDelay(100);
    return MOCK_DEPLOYMENTS.filter(d => 
      d.event_id === eventId && 
      d.status === "operating"
    ).length;
  },

  async markAsOperating(
    id: string, 
    feedbackType: 'yes' | 'insufficient' | 'suspended',
    notes?: string
  ): Promise<void> {
    await simulateDelay(200);
    const deployment = MOCK_DEPLOYMENTS.find(d => d.id === id);
    if (!deployment) return;

    switch (feedbackType) {
      case 'yes':
        deployment.status = 'operating';
        break;
      case 'insufficient':
        deployment.status = 'operating';
        // In real impl, would also create a signal
        break;
      case 'suspended':
        deployment.status = 'suspended';
        break;
    }

    if (notes) {
      deployment.notes = notes;
    }
    deployment.updated_at = new Date().toISOString();
  },
};

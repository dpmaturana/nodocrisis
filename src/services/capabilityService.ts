import { simulateDelay } from "./mock/delay";
import { 
  MOCK_CAPACITY_TYPES,
  MOCK_ACTOR_CAPABILITIES,
  getCapabilitiesByActorId,
  getCapacityTypeById,
  addCapability,
  deleteCapability,
  updateCapabilityAvailability,
} from "./mock/data";
import type { ActorCapability, CapacityType, AvailabilityStatus } from "@/types/database";

export interface CapabilityWithType extends ActorCapability {
  capacity_type?: CapacityType;
}

export const capabilityService = {
  async getCapacityTypes(): Promise<CapacityType[]> {
    await simulateDelay(100);
    return [...MOCK_CAPACITY_TYPES];
  },

  async getByActor(actorId: string): Promise<CapabilityWithType[]> {
    await simulateDelay(200);
    const capabilities = getCapabilitiesByActorId(actorId);
    
    return capabilities.map(c => ({
      ...c,
      capacity_type: getCapacityTypeById(c.capacity_type_id),
    }));
  },

  async add(capability: {
    user_id: string;
    capacity_type_id: string;
    quantity?: number;
    unit?: string;
    availability: AvailabilityStatus;
    notes?: string;
  }): Promise<ActorCapability> {
    await simulateDelay(300);
    return addCapability({
      user_id: capability.user_id,
      capacity_type_id: capability.capacity_type_id,
      quantity: capability.quantity || null,
      unit: capability.unit || null,
      availability: capability.availability,
      notes: capability.notes || null,
    });
  },

  async delete(id: string): Promise<void> {
    await simulateDelay(200);
    deleteCapability(id);
  },

  async updateAvailability(id: string, availability: AvailabilityStatus): Promise<void> {
    await simulateDelay(200);
    updateCapabilityAvailability(id, availability);
  },
};

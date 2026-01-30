import type {
  Actor,
  ActorCapabilityDeclared,
  ActorHabitualZone,
  ActorContact,
  ActorParticipationHistory,
  ActorWithDetails,
  ActorType,
  ActorStructuralStatus,
  CapabilityLevel,
  PresenceType,
} from "@/types/database";
import { simulateDelay } from "./mock/delay";
import {
  MOCK_ACTORS_NETWORK,
  MOCK_ACTOR_CAPABILITIES_DECLARED,
  MOCK_ACTOR_ZONES,
  MOCK_ACTOR_CONTACTS,
  MOCK_ACTOR_PARTICIPATION_HISTORY,
  MOCK_CAPACITY_TYPES,
} from "./mock/data";

// Mutable arrays for CRUD operations
let actors = [...MOCK_ACTORS_NETWORK];
let capabilities = [...MOCK_ACTOR_CAPABILITIES_DECLARED];
let zones = [...MOCK_ACTOR_ZONES];
let contacts = [...MOCK_ACTOR_CONTACTS];

function buildActorWithDetails(actor: Actor): ActorWithDetails {
  const actorCapabilities = capabilities.filter(c => c.actor_id === actor.id);
  const actorZones = zones.filter(z => z.actor_id === actor.id);
  const actorContacts = contacts.filter(c => c.actor_id === actor.id);
  
  const capacityTypeNames: Record<string, string> = {};
  actorCapabilities.forEach(cap => {
    const capType = MOCK_CAPACITY_TYPES.find(ct => ct.id === cap.capacity_type_id);
    if (capType) {
      capacityTypeNames[cap.capacity_type_id] = capType.name;
    }
  });

  return {
    actor,
    capabilities: actorCapabilities,
    zones: actorZones,
    contacts: actorContacts,
    capacityTypeNames,
  };
}

export interface CreateActorInput {
  user_id: string;
  organization_name: string;
  organization_type: ActorType;
  description?: string;
  structural_status?: ActorStructuralStatus;
}

export interface UpdateActorInput {
  organization_name?: string;
  organization_type?: ActorType;
  description?: string;
  structural_status?: ActorStructuralStatus;
}

export interface CreateCapabilityInput {
  capacity_type_id: string;
  level: CapabilityLevel;
  notes?: string;
}

export interface CreateZoneInput {
  region: string;
  commune?: string;
  presence_type: PresenceType;
}

export interface ContactInput {
  name: string;
  role: string;
  primary_channel: string;
  secondary_channel?: string;
  is_primary: boolean;
}

export const actorNetworkService = {
  // ============== LISTING ==============
  async getAll(): Promise<ActorWithDetails[]> {
    await simulateDelay(200);
    return actors.map(buildActorWithDetails);
  },

  async getById(actorId: string): Promise<ActorWithDetails | null> {
    await simulateDelay(100);
    const actor = actors.find(a => a.id === actorId);
    if (!actor) return null;
    return buildActorWithDetails(actor);
  },

  // ============== SEARCH & FILTERS ==============
  async search(query: string): Promise<ActorWithDetails[]> {
    await simulateDelay(150);
    const lowerQuery = query.toLowerCase();
    const filtered = actors.filter(a =>
      a.organization_name.toLowerCase().includes(lowerQuery) ||
      a.description?.toLowerCase().includes(lowerQuery)
    );
    return filtered.map(buildActorWithDetails);
  },

  async filterByCapacity(capacityTypeId: string): Promise<ActorWithDetails[]> {
    await simulateDelay(150);
    const actorIdsWithCapacity = capabilities
      .filter(c => c.capacity_type_id === capacityTypeId)
      .map(c => c.actor_id);
    const filtered = actors.filter(a => actorIdsWithCapacity.includes(a.id));
    return filtered.map(buildActorWithDetails);
  },

  async filterByZone(region: string): Promise<ActorWithDetails[]> {
    await simulateDelay(150);
    const actorIdsInZone = zones
      .filter(z => z.region === region)
      .map(z => z.actor_id);
    const filtered = actors.filter(a => actorIdsInZone.includes(a.id));
    return filtered.map(buildActorWithDetails);
  },

  async filterByType(type: ActorType): Promise<ActorWithDetails[]> {
    await simulateDelay(150);
    const filtered = actors.filter(a => a.organization_type === type);
    return filtered.map(buildActorWithDetails);
  },

  async filterMultiple(filters: {
    query?: string;
    capacityTypeId?: string;
    region?: string;
    type?: ActorType;
    status?: ActorStructuralStatus;
  }): Promise<ActorWithDetails[]> {
    await simulateDelay(200);
    
    let filtered = [...actors];
    
    if (filters.query) {
      const lowerQuery = filters.query.toLowerCase();
      filtered = filtered.filter(a =>
        a.organization_name.toLowerCase().includes(lowerQuery) ||
        a.description?.toLowerCase().includes(lowerQuery)
      );
    }
    
    if (filters.capacityTypeId) {
      const actorIdsWithCapacity = capabilities
        .filter(c => c.capacity_type_id === filters.capacityTypeId)
        .map(c => c.actor_id);
      filtered = filtered.filter(a => actorIdsWithCapacity.includes(a.id));
    }
    
    if (filters.region) {
      const actorIdsInZone = zones
        .filter(z => z.region === filters.region)
        .map(z => z.actor_id);
      filtered = filtered.filter(a => actorIdsInZone.includes(a.id));
    }
    
    if (filters.type) {
      filtered = filtered.filter(a => a.organization_type === filters.type);
    }
    
    if (filters.status) {
      filtered = filtered.filter(a => a.structural_status === filters.status);
    }
    
    return filtered.map(buildActorWithDetails);
  },

  // ============== CRUD ACTOR ==============
  async create(input: CreateActorInput): Promise<Actor> {
    await simulateDelay(300);
    const now = new Date().toISOString();
    const newActor: Actor = {
      id: `actor-net-${Date.now()}`,
      user_id: input.user_id,
      organization_name: input.organization_name,
      organization_type: input.organization_type,
      description: input.description || null,
      structural_status: input.structural_status || 'active',
      created_at: now,
      updated_at: now,
    };
    actors = [...actors, newActor];
    return newActor;
  },

  async update(actorId: string, data: UpdateActorInput): Promise<Actor> {
    await simulateDelay(200);
    const idx = actors.findIndex(a => a.id === actorId);
    if (idx === -1) throw new Error('Actor not found');
    
    const updated: Actor = {
      ...actors[idx],
      ...data,
      updated_at: new Date().toISOString(),
    };
    actors = actors.map(a => a.id === actorId ? updated : a);
    return updated;
  },

  async setStatus(actorId: string, status: ActorStructuralStatus): Promise<void> {
    await simulateDelay(150);
    actors = actors.map(a =>
      a.id === actorId
        ? { ...a, structural_status: status, updated_at: new Date().toISOString() }
        : a
    );
  },

  async delete(actorId: string): Promise<void> {
    await simulateDelay(200);
    actors = actors.filter(a => a.id !== actorId);
    capabilities = capabilities.filter(c => c.actor_id !== actorId);
    zones = zones.filter(z => z.actor_id !== actorId);
    contacts = contacts.filter(c => c.actor_id !== actorId);
  },

  // ============== CAPABILITIES ==============
  async addCapability(actorId: string, input: CreateCapabilityInput): Promise<ActorCapabilityDeclared> {
    await simulateDelay(200);
    const now = new Date().toISOString();
    const newCap: ActorCapabilityDeclared = {
      id: `acd-${Date.now()}`,
      actor_id: actorId,
      capacity_type_id: input.capacity_type_id,
      level: input.level,
      notes: input.notes || null,
      created_at: now,
      updated_at: now,
    };
    capabilities = [...capabilities, newCap];
    return newCap;
  },

  async updateCapability(capabilityId: string, data: Partial<CreateCapabilityInput>): Promise<void> {
    await simulateDelay(150);
    capabilities = capabilities.map(c =>
      c.id === capabilityId
        ? { ...c, ...data, updated_at: new Date().toISOString() }
        : c
    );
  },

  async removeCapability(capabilityId: string): Promise<void> {
    await simulateDelay(150);
    capabilities = capabilities.filter(c => c.id !== capabilityId);
  },

  // ============== ZONES ==============
  async addZone(actorId: string, input: CreateZoneInput): Promise<ActorHabitualZone> {
    await simulateDelay(200);
    const newZone: ActorHabitualZone = {
      id: `zone-${Date.now()}`,
      actor_id: actorId,
      region: input.region,
      commune: input.commune || null,
      presence_type: input.presence_type,
      created_at: new Date().toISOString(),
    };
    zones = [...zones, newZone];
    return newZone;
  },

  async removeZone(zoneId: string): Promise<void> {
    await simulateDelay(150);
    zones = zones.filter(z => z.id !== zoneId);
  },

  // ============== CONTACTS ==============
  async setContacts(actorId: string, newContacts: ContactInput[]): Promise<void> {
    await simulateDelay(200);
    // Remove existing contacts
    contacts = contacts.filter(c => c.actor_id !== actorId);
    
    // Add new contacts (max 2)
    const now = new Date().toISOString();
    const toAdd = newContacts.slice(0, 2).map((input, idx) => ({
      id: `contact-${Date.now()}-${idx}`,
      actor_id: actorId,
      name: input.name,
      role: input.role,
      primary_channel: input.primary_channel,
      secondary_channel: input.secondary_channel || null,
      is_primary: input.is_primary,
      created_at: now,
      updated_at: now,
    }));
    
    contacts = [...contacts, ...toAdd];
  },

  // ============== PARTICIPATION HISTORY (read-only) ==============
  async getParticipationHistory(actorId: string): Promise<ActorParticipationHistory[]> {
    await simulateDelay(150);
    return MOCK_ACTOR_PARTICIPATION_HISTORY.filter(h => {
      // Match by actor_id in our mock structure
      const actor = actors.find(a => a.id === actorId);
      if (!actor) return false;
      // For demo, return history for first 2 actors
      return actorId === 'actor-net-1' || actorId === 'actor-net-2';
    });
  },

  // ============== UTILITY ==============
  getCapacityTypes() {
    return MOCK_CAPACITY_TYPES;
  },
};
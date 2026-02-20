import { supabase } from "@/integrations/supabase/client";
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
  CapacityType,
  PresenceType,
} from "@/types/database";

// The actor network tables (actors, actor_capabilities_declared, actor_habitual_zones, actor_contacts)
// exist in the database but are not yet in the auto-generated types file.
// We use a typed helper to bypass the type checker for these tables.
const db = supabase as any;

async function buildActorWithDetails(actor: Actor): Promise<ActorWithDetails> {
  const [{ data: caps }, { data: zoneRows }, { data: contactRows }] = await Promise.all([
    db.from("actor_capabilities_declared").select("*").eq("actor_id", actor.id),
    db.from("actor_habitual_zones").select("*").eq("actor_id", actor.id),
    db.from("actor_contacts").select("*").eq("actor_id", actor.id),
  ]);

  const capabilities = (caps || []) as ActorCapabilityDeclared[];
  const zones = (zoneRows || []) as ActorHabitualZone[];
  const contacts = (contactRows || []) as ActorContact[];

  // Build capacity type names from the joined capabilities
  const capacityTypeNames: Record<string, string> = {};
  if (capabilities.length > 0) {
    const capTypeIds = capabilities.map((c) => c.capacity_type_id);
    const { data: capTypes } = await supabase
      .from("capacity_types")
      .select("id, name")
      .in("id", capTypeIds);
    (capTypes || []).forEach((ct: any) => {
      capacityTypeNames[ct.id] = ct.name;
    });
  }

  return { actor, capabilities, zones, contacts, capacityTypeNames };
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
    const { data, error } = await db.from("actors").select("*");
    if (error) throw error;
    if (!data || data.length === 0) return [];
    return Promise.all((data as any[]).map((a: any) => buildActorWithDetails(a)));
  },

  async getById(actorId: string): Promise<ActorWithDetails | null> {
    const { data, error } = await db
      .from("actors")
      .select("*")
      .eq("id", actorId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return buildActorWithDetails(data as any);
  },

  // ============== SEARCH & FILTERS ==============
  async search(query: string): Promise<ActorWithDetails[]> {
    const { data, error } = await db
      .from("actors")
      .select("*")
      .or(`organization_name.ilike.%${query}%,description.ilike.%${query}%`);
    if (error) throw error;
    if (!data || data.length === 0) return [];
    return Promise.all((data as any[]).map((a: any) => buildActorWithDetails(a)));
  },

  async filterByCapacity(capacityTypeId: string): Promise<ActorWithDetails[]> {
    const { data: capRows, error: capErr } = await db
      .from("actor_capabilities_declared")
      .select("actor_id")
      .eq("capacity_type_id", capacityTypeId);
    if (capErr) throw capErr;
    if (!capRows || capRows.length === 0) return [];

    const actorIds = [...new Set((capRows as any[]).map((r: any) => r.actor_id))];
    const { data, error } = await db
      .from("actors")
      .select("*")
      .in("id", actorIds);
    if (error) throw error;
    if (!data || data.length === 0) return [];
    return Promise.all((data as any[]).map((a: any) => buildActorWithDetails(a)));
  },

  async filterByZone(region: string): Promise<ActorWithDetails[]> {
    const { data: zoneRows, error: zoneErr } = await db
      .from("actor_habitual_zones")
      .select("actor_id")
      .eq("region", region);
    if (zoneErr) throw zoneErr;
    if (!zoneRows || zoneRows.length === 0) return [];

    const actorIds = [...new Set((zoneRows as any[]).map((r: any) => r.actor_id))];
    const { data, error } = await db
      .from("actors")
      .select("*")
      .in("id", actorIds);
    if (error) throw error;
    if (!data || data.length === 0) return [];
    return Promise.all((data as any[]).map((a: any) => buildActorWithDetails(a)));
  },

  async filterByType(type: ActorType): Promise<ActorWithDetails[]> {
    const { data, error } = await db
      .from("actors")
      .select("*")
      .eq("organization_type", type);
    if (error) throw error;
    if (!data || data.length === 0) return [];
    return Promise.all((data as any[]).map((a: any) => buildActorWithDetails(a)));
  },

  async filterMultiple(filters: {
    query?: string;
    capacityTypeId?: string;
    region?: string;
    type?: ActorType;
    status?: ActorStructuralStatus;
  }): Promise<ActorWithDetails[]> {
    let query = db.from("actors").select("*");

    if (filters.query) {
      query = query.or(
        `organization_name.ilike.%${filters.query}%,description.ilike.%${filters.query}%`,
      );
    }
    if (filters.type) {
      query = query.eq("organization_type", filters.type);
    }
    if (filters.status) {
      query = query.eq("structural_status", filters.status);
    }

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) return [];

    let actorRows: any[] = data as any[];

    // Filter by capacity type if specified
    if (filters.capacityTypeId) {
      const { data: capRows } = await db
        .from("actor_capabilities_declared")
        .select("actor_id")
        .eq("capacity_type_id", filters.capacityTypeId);
      const capActorIds = new Set((capRows || []).map((r: any) => r.actor_id));
      actorRows = actorRows.filter((a) => capActorIds.has(a.id));
    }

    // Filter by region if specified
    if (filters.region) {
      const { data: zoneRows } = await db
        .from("actor_habitual_zones")
        .select("actor_id")
        .eq("region", filters.region);
      const zoneActorIds = new Set(
        (zoneRows || []).map((r: any) => r.actor_id),
      );
      actorRows = actorRows.filter((a) => zoneActorIds.has(a.id));
    }

    if (actorRows.length === 0) return [];
    return Promise.all(actorRows.map((a: any) => buildActorWithDetails(a)));
  },

  // ============== CRUD ACTOR ==============
  async create(input: CreateActorInput): Promise<Actor> {
    const { data, error } = await db
      .from("actors")
      .insert({
        user_id: input.user_id,
        organization_name: input.organization_name,
        organization_type: input.organization_type,
        description: input.description || null,
        structural_status: input.structural_status || "active",
      })
      .select()
      .single();

    if (error) throw error;
    return data as any;
  },

  async update(actorId: string, data: UpdateActorInput): Promise<Actor> {
    const { data: updated, error } = await db
      .from("actors")
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq("id", actorId)
      .select()
      .single();

    if (error) throw error;
    return updated as any;
  },

  async setStatus(actorId: string, status: ActorStructuralStatus): Promise<void> {
    const { error } = await db
      .from("actors")
      .update({ structural_status: status, updated_at: new Date().toISOString() })
      .eq("id", actorId);
    if (error) throw error;
  },

  async delete(actorId: string): Promise<void> {
    const { error } = await db.from("actors").delete().eq("id", actorId);
    if (error) throw error;
  },

  // ============== CAPABILITIES ==============
  async addCapability(actorId: string, input: CreateCapabilityInput): Promise<ActorCapabilityDeclared> {
    const { data, error } = await db
      .from("actor_capabilities_declared")
      .insert({
        actor_id: actorId,
        capacity_type_id: input.capacity_type_id,
        level: input.level,
        notes: input.notes || null,
      })
      .select()
      .single();

    if (error) throw error;
    return data as any;
  },

  async updateCapability(capabilityId: string, data: Partial<CreateCapabilityInput>): Promise<void> {
    const { error } = await db
      .from("actor_capabilities_declared")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", capabilityId);
    if (error) throw error;
  },

  async removeCapability(capabilityId: string): Promise<void> {
    const { error } = await db
      .from("actor_capabilities_declared")
      .delete()
      .eq("id", capabilityId);
    if (error) throw error;
  },

  // ============== ZONES ==============
  async addZone(actorId: string, input: CreateZoneInput): Promise<ActorHabitualZone> {
    const { data, error } = await db
      .from("actor_habitual_zones")
      .insert({
        actor_id: actorId,
        region: input.region,
        commune: input.commune || null,
        presence_type: input.presence_type,
      })
      .select()
      .single();

    if (error) throw error;
    return data as any;
  },

  async removeZone(zoneId: string): Promise<void> {
    const { error } = await db
      .from("actor_habitual_zones")
      .delete()
      .eq("id", zoneId);
    if (error) throw error;
  },

  // ============== CONTACTS ==============
  async setContacts(actorId: string, newContacts: ContactInput[]): Promise<void> {
    const { error: delErr } = await db
      .from("actor_contacts")
      .delete()
      .eq("actor_id", actorId);
    if (delErr) throw delErr;

    const toInsert = newContacts.slice(0, 2).map((input) => ({
      actor_id: actorId,
      name: input.name,
      role: input.role,
      primary_channel: input.primary_channel,
      secondary_channel: input.secondary_channel || null,
      is_primary: input.is_primary,
    }));

    if (toInsert.length > 0) {
      const { error } = await db
        .from("actor_contacts")
        .insert(toInsert);
      if (error) throw error;
    }
  },

  // ============== PARTICIPATION HISTORY (derived from deployments) ==============
  async getParticipationHistory(actorId: string): Promise<ActorParticipationHistory[]> {
    const { data: deps, error } = await supabase
      .from("deployments")
      .select("*, events(*), sectors(*), capacity_types:capacity_type_id(*)")
      .eq("actor_id", actorId)
      .in("status", ["operating", "finished"]);

    if (error) throw error;
    if (!deps || deps.length === 0) return [];

    const eventMap = new Map<string, {
      event_name: string;
      capacities: Set<string>;
      sectors: Set<string>;
      started_at: string;
      ended_at: string | null;
    }>();

    deps.forEach((d: any) => {
      const eventId = d.event_id;
      if (!eventMap.has(eventId)) {
        eventMap.set(eventId, {
          event_name: d.events?.name || "Evento",
          capacities: new Set(),
          sectors: new Set(),
          started_at: d.created_at,
          ended_at: d.status === "finished" ? d.updated_at : null,
        });
      }
      const entry = eventMap.get(eventId)!;
      if (d.capacity_types?.name) entry.capacities.add(d.capacity_types.name);
      if (d.sectors?.canonical_name) entry.sectors.add(d.sectors.canonical_name);
      if (d.created_at < entry.started_at) entry.started_at = d.created_at;
    });

    return Array.from(eventMap.entries()).map(([eventId, entry]) => ({
      event_id: eventId,
      event_name: entry.event_name,
      capacities_activated: Array.from(entry.capacities),
      sectors_operated: Array.from(entry.sectors),
      started_at: entry.started_at,
      ended_at: entry.ended_at,
    }));
  },

  // ============== UTILITY ==============
  async getCapacityTypes(): Promise<CapacityType[]> {
    const { data, error } = await supabase.from("capacity_types").select("*");
    if (error) throw error;
    return (data || []) as any;
  },
};

import { supabase } from "@/integrations/supabase/client";
import type { ActorCapability, CapacityType, AvailabilityStatus } from "@/types/database";

export interface CapabilityWithType extends ActorCapability {
  capacity_type?: CapacityType;
}

export const capabilityService = {
  async getCapacityTypes(): Promise<CapacityType[]> {
    const { data, error } = await supabase
      .from('capacity_types')
      .select('*')
      .order('name');
    
    if (error) throw error;
    return (data || []) as CapacityType[];
  },

  async getByActor(actorId: string): Promise<CapabilityWithType[]> {
    const { data, error } = await supabase
      .from('actor_capabilities')
      .select(`
        *,
        capacity_type:capacity_types(*)
      `)
      .eq('user_id', actorId);
    
    if (error) throw error;
    
    return (data || []).map(row => ({
      id: row.id,
      user_id: row.user_id,
      capacity_type_id: row.capacity_type_id,
      quantity: row.quantity,
      unit: row.unit,
      availability: row.availability as AvailabilityStatus,
      notes: row.notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
      capacity_type: row.capacity_type as CapacityType | undefined,
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
    const { data, error } = await supabase
      .from('actor_capabilities')
      .insert({
        user_id: capability.user_id,
        capacity_type_id: capability.capacity_type_id,
        quantity: capability.quantity || null,
        unit: capability.unit || null,
        availability: capability.availability,
        notes: capability.notes || null,
      })
      .select()
      .single();
    
    if (error) throw error;
    return data as ActorCapability;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('actor_capabilities')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  async updateAvailability(id: string, availability: AvailabilityStatus): Promise<void> {
    const { error } = await supabase
      .from('actor_capabilities')
      .update({ availability })
      .eq('id', id);
    
    if (error) throw error;
  },
};

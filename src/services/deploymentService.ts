import { supabase } from "@/integrations/supabase/client";
import type { Deployment, DeploymentStatus, Event, Sector, CapacityType } from "@/types/database";

export interface DeploymentWithDetails extends Deployment {
  event?: Event;
  sector?: Sector;
  capacity_type?: CapacityType;
}

export const deploymentService = {
  async getMyDeployments(actorId: string): Promise<DeploymentWithDetails[]> {
    const { data, error } = await supabase
      .from("deployments")
      .select(`
        *,
        events (*),
        sectors (*),
        capacity_types (*)
      `)
      .eq("actor_id", actorId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching deployments:", error);
      throw error;
    }

    return (data || []).map((d: any) => ({
      id: d.id,
      event_id: d.event_id,
      sector_id: d.sector_id,
      capacity_type_id: d.capacity_type_id,
      actor_id: d.actor_id,
      status: d.status as DeploymentStatus,
      notes: d.notes,
      verified: d.verified,
      created_at: d.created_at,
      updated_at: d.updated_at,
      event: d.events as Event | undefined,
      sector: d.sectors as Sector | undefined,
      capacity_type: d.capacity_types as CapacityType | undefined,
    }));
  },

  async enroll(
    actorId: string,
    eventId: string,
    sectorId: string,
    capacityTypeId: string,
    notes?: string
  ): Promise<Deployment> {
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

    if (error) {
      console.error("Error creating deployment:", error);
      throw error;
    }

    return {
      ...data,
      status: data.status as DeploymentStatus,
    };
  },

  async updateStatus(id: string, status: DeploymentStatus): Promise<void> {
    const { error } = await supabase
      .from("deployments")
      .update({ status })
      .eq("id", id);

    if (error) {
      console.error("Error updating deployment status:", error);
      throw error;
    }
  },

  async getActiveCount(): Promise<number> {
    const { count, error } = await supabase
      .from("deployments")
      .select("*", { count: "exact", head: true })
      .eq("status", "operating");

    if (error) {
      console.error("Error counting active deployments:", error);
      return 0;
    }

    return count || 0;
  },

  async getOperatingCount(eventId: string): Promise<number> {
    const { count, error } = await supabase
      .from("deployments")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("status", "operating");

    if (error) {
      console.error("Error counting operating deployments:", error);
      return 0;
    }

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

    const updateData: { status: DeploymentStatus; notes?: string } = { status };
    if (notes) {
      updateData.notes = notes;
    }

    const { error } = await supabase
      .from("deployments")
      .update(updateData)
      .eq("id", id);

    if (error) {
      console.error("Error marking deployment as operating:", error);
      throw error;
    }
  },
};

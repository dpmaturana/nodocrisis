import { supabase } from "@/integrations/supabase/client";

export type NeedLevelExtended = "unknown" | "low" | "medium" | "high" | "critical" | "covered";

export const matrixService = {
  async getMatrix(eventId?: string): Promise<Record<string, Record<string, NeedLevelExtended>>> {
    if (!eventId) return {};

    const { data, error } = await supabase
      .from("sector_needs_context")
      .select("sector_id, capacity_type_id, level")
      .eq("event_id", eventId);

    if (error || !data) return {};

    const matrix: Record<string, Record<string, NeedLevelExtended>> = {};
    for (const row of data) {
      if (!matrix[row.sector_id]) matrix[row.sector_id] = {};
      matrix[row.sector_id][row.capacity_type_id] = row.level as NeedLevelExtended;
    }
    return matrix;
  },

  async updateCell(sectorId: string, capacityId: string, level: NeedLevelExtended, eventId?: string): Promise<void> {
    if (!eventId) return;
    const { error } = await supabase
      .from("sector_needs_context")
      .upsert(
        {
          event_id: eventId,
          sector_id: sectorId,
          capacity_type_id: capacityId,
          level,
          source: "manual",
          notes: null,
          created_by: null,
          expires_at: null,
        },
        { onConflict: "event_id,sector_id,capacity_type_id" },
      );
    if (error) throw new Error(error.message);
  },

  getLevelColor(level: NeedLevelExtended): string {
    switch (level) {
      case "critical": return "bg-gap-critical text-white";
      case "high": return "bg-warning text-warning-foreground";
      case "medium": return "bg-amber-500/80 text-white";
      case "low": return "bg-amber-300 text-amber-900";
      case "covered": return "bg-coverage text-coverage-foreground";
      case "unknown": 
      default: return "bg-muted text-muted-foreground";
    }
  },

  getLevelLabel(level: NeedLevelExtended): string {
    switch (level) {
      case "critical": return "Crítico";
      case "high": return "Alto";
      case "medium": return "Medio";
      case "low": return "Bajo";
      case "covered": return "Cubierto";
      case "unknown": 
      default: return "Sin info";
    }
  },
};

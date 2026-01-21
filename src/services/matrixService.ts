import { simulateDelay } from "./mock/delay";
import { 
  MOCK_SECTOR_CAPABILITY_MATRIX,
  updateMatrixCell,
  type NeedLevelExtended,
} from "./mock/data";

export type { NeedLevelExtended };

export const matrixService = {
  async getMatrix(eventId?: string): Promise<Record<string, Record<string, NeedLevelExtended>>> {
    await simulateDelay(150);
    // For now, return the full matrix. In a real app, you'd filter by event sectors
    return { ...MOCK_SECTOR_CAPABILITY_MATRIX };
  },

  async updateCell(sectorId: string, capacityId: string, level: NeedLevelExtended): Promise<void> {
    await simulateDelay(200);
    updateMatrixCell(sectorId, capacityId, level);
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

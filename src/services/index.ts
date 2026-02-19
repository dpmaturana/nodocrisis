// Service layer - connected to Supabase for real data

export { situationReportService } from "./situationReportService";
export { eventService } from "./eventService";
export { sectorService } from "./sectorService";
export type { EnrichedSector, RecommendedSector } from "./sectorService";
export { deploymentService } from "./deploymentService";
export { capabilityService } from "./capabilityService";
export { matrixService } from "./matrixService";
export { gapService } from "./gapService";
export type { GapWithDetails, GapCounts } from "./gapService";
export type { NeedLevelExtended } from "./matrixService";

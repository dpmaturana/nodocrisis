// Service layer - currently using mock implementations
// When ready to connect to Supabase, swap implementations here

export { situationReportService } from "./situationReportService";
export { eventService } from "./eventService";
export { sectorService } from "./sectorService";
export { deploymentService } from "./deploymentService";
export { capabilityService } from "./capabilityService";
export { matrixService } from "./matrixService";
export type { NeedLevelExtended } from "./matrixService";

// Re-export mock data for components that need direct access
export { 
  MOCK_CAPACITY_TYPES,
  MOCK_EVENTS,
  MOCK_SECTORS,
  MOCK_ACTIVE_EVENT,
  MOCK_SECTOR_CAPABILITY_MATRIX,
  MOCK_DEPLOYMENTS,
  MOCK_ACTOR_CAPABILITIES,
} from "./mock/data";

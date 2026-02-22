import { CapacityIcon } from "@/components/ui/CapacityIcon";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { DeploymentWithDetails } from "@/services/deploymentService";
import type { DeploymentStatus } from "@/types/database";

interface CapabilityRowProps {
  deployment: DeploymentWithDetails;
}

const statusToVariant: Record<DeploymentStatus, "deploy-interested" | "deploy-confirmed" | "deploy-operating" | "deploy-suspended" | "deploy-finished"> = {
  interested: "deploy-interested",
  confirmed: "deploy-confirmed",
  operating: "deploy-operating",
  suspended: "deploy-suspended",
  finished: "deploy-finished",
};

const statusLabels: Record<DeploymentStatus, string> = {
  interested: "Interested",
  confirmed: "Confirmed",
  operating: "Operating",
  suspended: "Suspended",
  finished: "Finished",
};

export function CapabilityRow({ deployment }: CapabilityRowProps) {
  return (
    <div className="p-3 bg-muted/50 rounded-lg space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CapacityIcon
            name={deployment.capacity_type?.name || ""}
            icon={deployment.capacity_type?.icon}
            size="sm"
          />
          <span className="font-medium text-sm">
            {deployment.capacity_type?.name || "Capability"}
          </span>
        </div>
        <StatusBadge
          status={statusToVariant[deployment.status]}
          label={statusLabels[deployment.status]}
          size="sm"
        />
      </div>

      {/* Requirement pills */}
      {deployment.operational_requirements && deployment.operational_requirements.length > 0 && (
        <div className="flex flex-wrap gap-1 pl-9">
          {deployment.operational_requirements.map((req, i) => (
            <span
              key={i}
              className="px-2 py-0.5 text-xs rounded-full border border-border bg-card text-muted-foreground"
            >
              {req}
            </span>
          ))}
        </div>
      )}

      {/* Reasoning summary */}
      {deployment.reasoning_summary && (
        <p className="text-xs text-muted-foreground italic pl-9">
          {deployment.reasoning_summary}
        </p>
      )}
    </div>
  );
}

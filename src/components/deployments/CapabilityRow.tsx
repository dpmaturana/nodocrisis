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
  interested: "Interesado",
  confirmed: "Confirmado",
  operating: "Operando",
  suspended: "Suspendido",
  finished: "Finalizado",
};

export function CapabilityRow({ deployment }: CapabilityRowProps) {
  return (
    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
      <div className="flex items-center gap-3">
        <CapacityIcon
          name={deployment.capacity_type?.name || ""}
          icon={deployment.capacity_type?.icon}
          size="sm"
        />
        <div>
          <span className="font-medium text-sm">
            {deployment.capacity_type?.name || "Capacidad"}
          </span>
          {deployment.notes && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {deployment.notes}
            </p>
          )}
        </div>
      </div>
      <StatusBadge
        status={statusToVariant[deployment.status]}
        label={statusLabels[deployment.status]}
        size="sm"
      />
    </div>
  );
}

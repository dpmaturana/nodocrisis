import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { deploymentService, SectorDeploymentGroup } from "@/services/deploymentService";

export type ActorMode = "exploration" | "operation" | "loading";

export function useActorMode() {
  const { user, isActor, isAdmin } = useAuth();
  const [mode, setMode] = useState<ActorMode>("loading");
  const [activeGroups, setActiveGroups] = useState<SectorDeploymentGroup[]>([]);

  const refreshMode = async () => {
    if (!user || !isActor || isAdmin) {
      setMode("exploration");
      return;
    }

    try {
      const groups = await deploymentService.getMyDeploymentsGrouped(user.id);
      const active = groups.filter((g) =>
        g.deployments.some((d) => !["finished", "suspended"].includes(d.status))
      );
      setActiveGroups(active);
      setMode(active.length > 0 ? "operation" : "exploration");
    } catch (error) {
      console.error("Error fetching actor mode:", error);
      setMode("exploration");
    }
  };

  useEffect(() => {
    refreshMode();
  }, [user, isActor, isAdmin]);

  return {
    mode,
    activeGroups,
    isOperating: mode === "operation",
    isExploring: mode === "exploration",
    isLoading: mode === "loading",
    refreshMode,
  };
}

import { useEffect } from "react";
import { Outlet, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useActorMode } from "@/hooks/useActorMode";
import { ActorHeader } from "./ActorHeader";
import { Skeleton } from "@/components/ui/skeleton";

export function ActorLayout() {
  const { user, isLoading: authLoading } = useAuth();
  const { mode, isLoading: modeLoading } = useActorMode();
  const location = useLocation();
  const navigate = useNavigate();

  // Allowed routes for actors that don't trigger auto-redirect
  const configRoutes = ["/my-capabilities"];
  const isConfigRoute = configRoutes.includes(location.pathname);
  const currentPath = location.pathname;

  // Auto-redirect based on mode (only from root, dashboard, or unexpected routes)
  useEffect(() => {
    if (modeLoading || isConfigRoute) return;

    const shouldRedirectToOperation = 
      mode === "operation" && 
      currentPath !== "/my-deployments" && 
      currentPath !== "/sectors";

    const shouldRedirectToExploration = 
      mode === "exploration" && 
      currentPath !== "/sectors" && 
      currentPath !== "/my-deployments";

    const isRootOrDashboard = currentPath === "/" || currentPath === "/dashboard";

    if (isRootOrDashboard) {
      if (mode === "operation") {
        navigate("/my-deployments", { replace: true });
      } else if (mode === "exploration") {
        navigate("/sectors", { replace: true });
      }
    } else if (shouldRedirectToOperation) {
      navigate("/my-deployments", { replace: true });
    } else if (shouldRedirectToExploration) {
      navigate("/sectors", { replace: true });
    }
  }, [mode, modeLoading, currentPath, isConfigRoute, navigate]);

  if (authLoading || modeLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-40 bg-background border-b border-border">
          <div className="flex items-center justify-between px-4 py-3">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-8 w-40" />
          </div>
        </div>
        <div className="p-4 md:p-6 space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <ActorHeader />
      <main className="p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  );
}

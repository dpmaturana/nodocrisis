import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AdminTopNav } from "./AdminTopNav";
import { ActorLayout } from "./ActorLayout";
import { Skeleton } from "@/components/ui/skeleton";

export function AppLayout() {
  const { user, isLoading, isAdmin, isActor } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen bg-background">
        <div className="w-64 border-r border-border p-4 space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-8 w-3/4" />
        </div>
        <div className="flex-1 p-6">
          <Skeleton className="h-8 w-48 mb-4" />
          <div className="grid grid-cols-4 gap-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // ONGs/Actors use simplified layout without sidebar
  if (isActor && !isAdmin) {
    return <ActorLayout />;
  }

  // Admins use horizontal top nav layout
  return (
    <div className="min-h-screen bg-background">
      <AdminTopNav />
      <main>
        <Outlet />
      </main>
    </div>
  );
}

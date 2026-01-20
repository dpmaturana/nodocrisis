import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CapacityIcon } from "@/components/ui/CapacityIcon";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Activity, ChevronRight, MapPin, Users } from "@/lib/icons";
import type { Deployment, DeploymentStatus, Event, Sector, CapacityType } from "@/types/database";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface DeploymentWithDetails extends Deployment {
  event?: Event;
  sector?: Sector;
  capacity_type?: CapacityType;
}

export default function MyDeployments() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [deployments, setDeployments] = useState<DeploymentWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDeployments = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from("deployments")
          .select("*, events(*), sectors(*), capacity_types(*)")
          .eq("actor_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;

        setDeployments(
          (data || []).map((d: any) => ({
            ...d,
            event: d.events,
            sector: d.sectors,
            capacity_type: d.capacity_types,
          }))
        );
      } catch (error) {
        console.error("Error fetching deployments:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDeployments();
  }, [user]);

  const handleUpdateStatus = async (id: string, newStatus: DeploymentStatus) => {
    try {
      const { error } = await supabase
        .from("deployments")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;

      setDeployments(deployments.map((d) => (d.id === id ? { ...d, status: newStatus } : d)));

      toast({
        title: "Estado actualizado",
        description: `El despliegue ahora está ${statusLabels[newStatus]}.`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const statusLabels: Record<DeploymentStatus, string> = {
    planned: "Planificado",
    active: "Activo",
    completed: "Completado",
    cancelled: "Cancelado",
  };

  const statusVariants: Record<DeploymentStatus, "warning" | "covered" | "pending" | "critical"> = {
    planned: "warning",
    active: "covered",
    completed: "pending",
    cancelled: "critical",
  };

  const activeDeployments = deployments.filter((d) => d.status === "active" || d.status === "planned");
  const pastDeployments = deployments.filter((d) => d.status === "completed" || d.status === "cancelled");

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mis Despliegues</h1>
          <p className="text-muted-foreground mt-1">
            Gestiona tus inscripciones y despliegues en sectores de emergencia
          </p>
        </div>
        <Button asChild>
          <Link to="/sectors">
            <MapPin className="w-4 h-4 mr-2" />
            Ver Sectores Recomendados
          </Link>
        </Button>
      </div>

      {/* Active Deployments */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          Despliegues Activos ({activeDeployments.length})
        </h2>
        {activeDeployments.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="w-12 h-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground mb-4">No tienes despliegues activos</p>
              <Button variant="outline" asChild>
                <Link to="/sectors">
                  <MapPin className="w-4 h-4 mr-2" />
                  Buscar sectores donde ayudar
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {activeDeployments.map((deployment) => (
              <DeploymentCard
                key={deployment.id}
                deployment={deployment}
                onUpdateStatus={handleUpdateStatus}
                statusLabels={statusLabels}
                statusVariants={statusVariants}
              />
            ))}
          </div>
        )}
      </div>

      {/* Past Deployments */}
      {pastDeployments.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4 text-muted-foreground">
            Historial ({pastDeployments.length})
          </h2>
          <div className="grid gap-4">
            {pastDeployments.map((deployment) => (
              <DeploymentCard
                key={deployment.id}
                deployment={deployment}
                onUpdateStatus={handleUpdateStatus}
                statusLabels={statusLabels}
                statusVariants={statusVariants}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DeploymentCard({
  deployment,
  onUpdateStatus,
  statusLabels,
  statusVariants,
}: {
  deployment: DeploymentWithDetails;
  onUpdateStatus: (id: string, status: DeploymentStatus) => void;
  statusLabels: Record<DeploymentStatus, string>;
  statusVariants: Record<DeploymentStatus, "warning" | "covered" | "pending" | "critical">;
}) {
  const isActive = deployment.status === "active" || deployment.status === "planned";

  return (
    <Card className={isActive ? "" : "opacity-70"}>
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <MapPin className="w-6 h-6 text-primary" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-lg">
                {deployment.sector?.canonical_name || "Sector desconocido"}
              </h3>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Activity className="w-4 h-4" />
                  {deployment.event?.name || "Evento"}
                </span>
                <CapacityIcon
                  name={deployment.capacity_type?.name || ""}
                  icon={deployment.capacity_type?.icon}
                  size="sm"
                  showLabel
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Inscrito: {format(new Date(deployment.created_at), "d MMM yyyy, HH:mm", { locale: es })}
              </p>
              {deployment.notes && (
                <p className="text-sm text-muted-foreground mt-2 italic">"{deployment.notes}"</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge
              status={statusVariants[deployment.status]}
              label={statusLabels[deployment.status]}
            />
            {isActive && (
              <Select
                value={deployment.status}
                onValueChange={(v) => onUpdateStatus(deployment.id, v as DeploymentStatus)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">Planificado</SelectItem>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="completed">Completado</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/events/${deployment.event_id}`}>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

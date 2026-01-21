import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { eventService, deploymentService } from "@/services";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CapacityIcon } from "@/components/ui/CapacityIcon";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, AlertTriangle, Building2, ChevronRight, MapPin, Plus, Users } from "@/lib/icons";
import type { Event, CapacityType } from "@/types/database";

interface DashboardData {
  activeEvents: Event[];
  capacityTypes: CapacityType[];
  deploymentCount: number;
  sectorCount: number;
}

export default function Dashboard() {
  const { isAdmin } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [activeEvents, capacityTypes, deploymentCount] = await Promise.all([
          eventService.getActive(),
          eventService.getCapacityTypes(),
          deploymentService.getActiveCount(),
        ]);

        // Count sectors from active events
        let sectorCount = 0;
        for (const event of activeEvents) {
          const sectors = await eventService.getSectorsForEvent(event.id);
          sectorCount += sectors.length;
        }

        setData({
          activeEvents,
          capacityTypes,
          deploymentCount,
          sectorCount,
        });
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const activeEventCount = data?.activeEvents.length || 0;
  const sectorCount = data?.sectorCount || 0;
  const criticalGaps = 0; // Would be calculated from matrix

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Centro de comando para coordinación de emergencias
          </p>
        </div>
        {isAdmin && (
          <Button asChild>
            <Link to="/admin/create-event">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Evento
            </Link>
          </Button>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Eventos Activos"
          value={activeEventCount}
          subtitle="Emergencias en curso"
          icon={Activity}
          variant={activeEventCount > 0 ? "warning" : "default"}
        />
        <StatCard
          title="Sectores Operativos"
          value={sectorCount}
          subtitle="Áreas con actividad"
          icon={MapPin}
        />
        <StatCard
          title="Brechas Críticas"
          value={criticalGaps}
          subtitle="Capacidades sin cobertura"
          icon={AlertTriangle}
          variant={criticalGaps > 0 ? "critical" : "success"}
        />
        <StatCard
          title="Despliegues Activos"
          value={data?.deploymentCount || 0}
          subtitle="Actores en terreno"
          icon={Users}
          variant="success"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Events */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Eventos Activos</CardTitle>
              <CardDescription>Emergencias en curso que requieren coordinación</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/events">
                Ver todos
                <ChevronRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {data?.activeEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Activity className="w-12 h-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No hay eventos activos</p>
                {isAdmin && (
                  <Button variant="outline" size="sm" className="mt-4" asChild>
                    <Link to="/admin/create-event">
                      <Plus className="w-4 h-4 mr-2" />
                      Crear evento
                    </Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {data?.activeEvents.map((event) => (
                  <Link
                    key={event.id}
                    to={isAdmin ? `/admin/event-dashboard/${event.id}` : `/events/${event.id}`}
                    className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center">
                        <Activity className="w-5 h-5 text-warning" />
                      </div>
                      <div>
                        <h3 className="font-semibold group-hover:text-primary transition-colors">
                          {event.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {event.location || "Sin ubicación definida"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status="warning" label="Activo" size="sm" />
                      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Capacity Types */}
        <Card>
          <CardHeader>
            <CardTitle>Tipos de Capacidad</CardTitle>
            <CardDescription>Recursos disponibles en el sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data?.capacityTypes.map((capacity) => (
                <div
                  key={capacity.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-accent/30 transition-colors"
                >
                  <CapacityIcon name={capacity.name} icon={capacity.icon} showLabel />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions for Actors */}
      {!isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Acciones Rápidas</CardTitle>
            <CardDescription>Gestiona tu participación en emergencias</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
                <Link to="/my-capabilities">
                  <Building2 className="w-6 h-6" />
                  <span>Gestionar Capacidades</span>
                </Link>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
                <Link to="/sectors">
                  <MapPin className="w-6 h-6" />
                  <span>Ver Sectores Recomendados</span>
                </Link>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
                <Link to="/my-deployments">
                  <Users className="w-6 h-6" />
                  <span>Mis Despliegues</span>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

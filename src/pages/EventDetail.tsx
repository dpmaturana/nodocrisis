import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { eventService } from "@/services";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { StatCard } from "@/components/ui/StatCard";
import { CapacityIcon } from "@/components/ui/CapacityIcon";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity,
  AlertTriangle,
  ChevronRight,
  MapPin,
  Plus,
  Users,
} from "@/lib/icons";
import type { Event, Sector, CapacityType, SectorGap } from "@/types/database";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function EventDetail() {
  const { eventId } = useParams<{ eventId: string }>();
  const { isAdmin } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [capacityTypes, setCapacityTypes] = useState<CapacityType[]>([]);
  const [gapData, setGapData] = useState<Map<string, Map<string, SectorGap>>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!eventId) return;

    const fetchEventData = async () => {
      try {
        const [eventData, sectorsData, capacitiesData, gaps] = await Promise.all([
          eventService.getById(eventId),
          eventService.getSectorsForEvent(eventId),
          eventService.getCapacityTypes(),
          eventService.getGapsForEvent(eventId),
        ]);

        setEvent(eventData);
        setSectors(sectorsData);
        setCapacityTypes(capacitiesData);
        setGapData(gaps);
      } catch (error) {
        console.error("Error fetching event data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEventData();
  }, [eventId]);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Activity className="w-16 h-16 text-muted-foreground/50 mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Evento no encontrado</h2>
        <p className="text-muted-foreground mb-6">El evento que buscas no existe o fue eliminado.</p>
        <Button asChild>
          <Link to="/events">Volver a Eventos</Link>
        </Button>
      </div>
    );
  }

  // Calculate summary stats
  const totalSectors = sectors.length;
  let criticalGaps = 0;
  let uncoveredSectors = 0;
  let totalDeployments = 0;

  gapData.forEach((sectorGaps) => {
    let sectorHasUncovered = false;
    sectorGaps.forEach((gap) => {
      if (gap.isCritical && gap.isUncovered) criticalGaps++;
      if (gap.isUncovered) sectorHasUncovered = true;
      totalDeployments += gap.coverage;
    });
    if (sectorHasUncovered) uncoveredSectors++;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link
              to="/events"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Eventos
            </Link>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">{event.name}</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{event.name}</h1>
          <div className="flex items-center gap-4 mt-2 text-muted-foreground">
            {event.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {event.location}
              </span>
            )}
            <span>
              Iniciado: {format(new Date(event.started_at), "d MMMM yyyy, HH:mm", { locale: es })}
            </span>
            <span>
              Población afectada: {event.population_affected?.toLocaleString() ?? "Sin dato"}
            </span>
            <StatusBadge
              status={event.status === "active" ? "warning" : "pending"}
              label={event.status === "active" ? "Activo" : "Cerrado"}
            />
          </div>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to={`/admin/coordination?event=${eventId}`}>
                <Plus className="w-4 h-4 mr-2" />
                Agregar Demanda
              </Link>
            </Button>
            <Button asChild>
              <Link to={`/admin/event-dashboard/${eventId}`}>
                Ver Matriz
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Sectores"
          value={totalSectors}
          subtitle="Áreas operativas"
          icon={MapPin}
        />
        <StatCard
          title="Brechas Críticas"
          value={criticalGaps}
          subtitle="Requieren atención urgente"
          icon={AlertTriangle}
          variant={criticalGaps > 0 ? "critical" : "success"}
        />
        <StatCard
          title="Sectores Sin Cobertura"
          value={uncoveredSectors}
          subtitle="Necesitan despliegue"
          icon={MapPin}
          variant={uncoveredSectors > 0 ? "warning" : "success"}
        />
        <StatCard
          title="Despliegues Activos"
          value={totalDeployments}
          subtitle="Actores en terreno"
          icon={Users}
          variant="success"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="gaps" className="w-full">
        <TabsList>
          <TabsTrigger value="gaps">Brechas por Sector</TabsTrigger>
          <TabsTrigger value="sectors">Sectores</TabsTrigger>
          <TabsTrigger value="timeline">Línea de Tiempo</TabsTrigger>
        </TabsList>

        <TabsContent value="gaps" className="mt-6">
          {sectors.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <MapPin className="w-12 h-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No hay sectores definidos para este evento</p>
                {isAdmin && (
                  <Button variant="outline" size="sm" className="mt-4" asChild>
                    <Link to={`/admin/coordination?event=${eventId}`}>
                      <Plus className="w-4 h-4 mr-2" />
                      Agregar sector
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {sectors.map((sector) => {
                const sectorGaps = gapData.get(sector.id);

                return (
                  <Card key={sector.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <MapPin className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{sector.canonical_name}</CardTitle>
                            <CardDescription>
                              Estado: {sector.status === "resolved" ? "Confirmado" : sector.status === "tentative" ? "Tentativo" : "Sin resolver"}
                            </CardDescription>
                          </div>
                        </div>
                        <StatusBadge
                          status={sector.status === "resolved" ? "covered" : "pending"}
                          label={sector.status}
                          size="sm"
                        />
                      </div>
                    </CardHeader>
                    <CardContent>
                      {!sectorGaps || sectorGaps.size === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                          Sin demanda registrada para este sector
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                          {Array.from(sectorGaps.values()).map((gap) => (
                            <div
                              key={gap.capacityType.id}
                              className={`p-3 rounded-lg border ${
                                gap.isCritical && gap.isUncovered
                                  ? "border-gap-critical/50 bg-gap-critical/5"
                                  : gap.isUncovered
                                  ? "border-warning/50 bg-warning/5"
                                  : "border-border"
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <CapacityIcon
                                  name={gap.capacityType.name}
                                  icon={gap.capacityType.icon}
                                  size="sm"
                                  showLabel
                                />
                              </div>
                              <div className="space-y-1 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-demand-sms">SMS:</span>
                                  <span className="font-mono">{gap.smsDemand}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-demand-context">Contexto:</span>
                                  <span className="font-mono">{gap.contextDemand}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-coverage">Cobertura:</span>
                                  <span className="font-mono">{gap.coverage}</span>
                                </div>
                                <div className="flex justify-between font-semibold pt-1 border-t border-border/50">
                                  <span>Brecha:</span>
                                  <span
                                    className={`font-mono ${
                                      gap.gap > 0 ? "text-gap-critical" : "text-coverage"
                                    }`}
                                  >
                                    {gap.gap}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="sectors" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Sectores Operativos</CardTitle>
              <CardDescription>
                Áreas geográficas o lógicas del evento
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sectors.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay sectores definidos
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sectors.map((sector) => (
                    <div
                      key={sector.id}
                      className="p-4 rounded-lg border border-border hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold">{sector.canonical_name}</h3>
                          {sector.aliases && sector.aliases.length > 0 && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Alias: {sector.aliases.join(", ")}
                            </p>
                          )}
                        </div>
                        <StatusBadge
                          status={sector.status === "resolved" ? "covered" : "pending"}
                          size="sm"
                          showIcon={false}
                        />
                      </div>
                      {sector.latitude && sector.longitude && (
                        <p className="text-xs text-muted-foreground mt-2 font-mono">
                          {sector.latitude.toFixed(4)}, {sector.longitude.toFixed(4)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Línea de Tiempo</CardTitle>
              <CardDescription>Actividad reciente del evento</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                La línea de tiempo estará disponible próximamente
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { eventService } from "@/services";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, ChevronRight, MapPin, Plus, Search } from "@/lib/icons";
import type { Event } from "@/types/database";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function Events() {
  const { isAdmin } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const data = await eventService.getAll();
        setEvents(data);
      } catch (error) {
        console.error("Error fetching events:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvents();
  }, []);

  const filteredEvents = events.filter(
    (event) =>
      event.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.location?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeEvents = filteredEvents.filter((e) => e.status === "active");
  const closedEvents = filteredEvents.filter((e) => e.status !== "active");

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
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
          <h1 className="text-3xl font-bold tracking-tight">Eventos de Emergencia</h1>
          <p className="text-muted-foreground mt-1">
            Gestiona y visualiza eventos de emergencia activos y pasados
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

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar eventos..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Active Events */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-warning" />
          Eventos Activos ({activeEvents.length})
        </h2>
        {activeEvents.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Activity className="w-12 h-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No hay eventos activos</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {activeEvents.map((event) => (
              <EventCard key={event.id} event={event} isAdmin={isAdmin} />
            ))}
          </div>
        )}
      </div>

      {/* Closed Events */}
      {closedEvents.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4 text-muted-foreground">
            Eventos Cerrados ({closedEvents.length})
          </h2>
          <div className="grid gap-4">
            {closedEvents.map((event) => (
              <EventCard key={event.id} event={event} isAdmin={isAdmin} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EventCard({ event, isAdmin }: { event: Event; isAdmin: boolean }) {
  const isActive = event.status === "active";
  const linkTo = isAdmin && isActive 
    ? `/admin/event-dashboard/${event.id}` 
    : `/events/${event.id}`;

  return (
    <Link
      to={linkTo}
      className="block group"
    >
      <Card className={`transition-all hover:border-primary/50 ${isActive ? "" : "opacity-70"}`}>
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                isActive ? "bg-warning/20" : "bg-muted"
              }`}
            >
              <Activity
                className={`w-6 h-6 ${isActive ? "text-warning" : "text-muted-foreground"}`}
              />
            </div>
            <div>
              <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                {event.name}
              </h3>
              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                {event.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {event.location}
                  </span>
                )}
                <span>
                  Iniciado: {format(new Date(event.started_at), "d MMM yyyy", { locale: es })}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <StatusBadge
              status={isActive ? "warning" : "pending"}
              label={isActive ? "Activo" : "Cerrado"}
            />
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

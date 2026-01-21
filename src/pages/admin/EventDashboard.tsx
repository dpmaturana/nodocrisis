import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { eventService } from "@/services";
import type { Event } from "@/types/database";
import type { GapWithDetails } from "@/services/gapService";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Activity } from "lucide-react";

// Dashboard components
import { EventHeader } from "@/components/dashboard/EventHeader";
import { GapMetrics } from "@/components/dashboard/GapMetrics";
import { ImmediateAttention } from "@/components/dashboard/ImmediateAttention";
import { MonitoredSectors } from "@/components/dashboard/MonitoredSectors";
import { GapDetailDrawer } from "@/components/dashboard/GapDetailDrawer";
import { AvailableActorsDrawer } from "@/components/dashboard/AvailableActorsDrawer";

export default function EventDashboard() {
  const { eventId } = useParams<{ eventId: string }>();
  
  const [event, setEvent] = useState<Event | null>(null);
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Drawer state
  const [selectedGap, setSelectedGap] = useState<GapWithDetails | null>(null);
  const [showGapDrawer, setShowGapDrawer] = useState(false);
  const [showActorsDrawer, setShowActorsDrawer] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const activeEvents = await eventService.getActive();
        setAllEvents(activeEvents);
        
        let targetEvent: Event | null = null;
        if (eventId) {
          targetEvent = await eventService.getById(eventId);
        } else {
          targetEvent = activeEvents[0] || null;
        }
        setEvent(targetEvent);
      } catch (error) {
        console.error("Error loading event:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [eventId]);

  const handleEventChange = (newEventId: string) => {
    window.location.href = `/admin/event-dashboard/${newEventId}`;
  };

  const handleViewGap = (gap: GapWithDetails) => {
    setSelectedGap(gap);
    setShowGapDrawer(true);
  };

  const handleViewActors = (gap: GapWithDetails) => {
    setSelectedGap(gap);
    setShowActorsDrawer(true);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  // No active event
  if (!event) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Activity className="w-16 h-16 text-muted-foreground/50 mb-4" />
        <h2 className="text-2xl font-semibold mb-2">No hay evento activo</h2>
        <p className="text-muted-foreground mb-6">Crea un evento para ver el dashboard.</p>
        <Button asChild>
          <Link to="/admin/create-event">Crear Evento</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header con evento y fase */}
      <EventHeader 
        event={event} 
        phase="unstable"
        allEvents={allEvents}
        onEventChange={handleEventChange}
      />
      
      {/* 4 métricas: sectores, críticas, parciales, operando */}
      <GapMetrics eventId={event.id} />
      
      {/* Lista priorizada de brechas */}
      <ImmediateAttention 
        eventId={event.id}
        onViewGap={handleViewGap}
        onViewActors={handleViewActors}
      />
      
      {/* Sectores monitoreados (collapse) */}
      <MonitoredSectors eventId={event.id} />
      
      {/* Drawer de detalle de brecha */}
      <GapDetailDrawer 
        gapId={selectedGap?.id || null}
        open={showGapDrawer}
        onOpenChange={setShowGapDrawer}
        onViewActors={() => {
          setShowGapDrawer(false);
          setShowActorsDrawer(true);
        }}
      />
      
      {/* Drawer de actores disponibles */}
      <AvailableActorsDrawer
        gap={selectedGap}
        open={showActorsDrawer}
        onOpenChange={setShowActorsDrawer}
      />
    </div>
  );
}

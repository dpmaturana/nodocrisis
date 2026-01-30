import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { eventService, gapService } from "@/services";
import type { Event, Signal } from "@/types/database";
import type { GapWithDetails, GapCounts, DashboardMeta, OperatingActor } from "@/services/gapService";
import type { SeverityFilter } from "@/components/dashboard/FilterChips";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Activity } from "lucide-react";

// Dashboard components
import { EventHeader } from "@/components/dashboard/EventHeader";
import { FilterChips } from "@/components/dashboard/FilterChips";
import { SectorGapList } from "@/components/dashboard/SectorGapList";
import { SignalsModal } from "@/components/dashboard/SignalsModal";
import { OperatingActorsModal } from "@/components/dashboard/OperatingActorsModal";
import { GapDetailDrawer } from "@/components/dashboard/GapDetailDrawer";
import { AvailableActorsDrawer } from "@/components/dashboard/AvailableActorsDrawer";

export default function EventDashboard() {
  const { eventId } = useParams<{ eventId: string }>();
  
  const [event, setEvent] = useState<Event | null>(null);
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Dashboard meta
  const [dashboardMeta, setDashboardMeta] = useState<DashboardMeta | null>(null);
  const [counts, setCounts] = useState<GapCounts | null>(null);
  
  // Filter state
  const [activeFilters, setActiveFilters] = useState<SeverityFilter[]>([]);
  
  // Modal/drawer states
  const [selectedGap, setSelectedGap] = useState<GapWithDetails | null>(null);
  const [signalsForModal, setSignalsForModal] = useState<Signal[]>([]);
  const [showSignalsModal, setShowSignalsModal] = useState(false);
  const [showGapDrawer, setShowGapDrawer] = useState(false);
  const [showActorsDrawer, setShowActorsDrawer] = useState(false);
  
  // Operating actors modal
  const [operatingActors, setOperatingActors] = useState<OperatingActor[]>([]);
  const [showOperatingActorsModal, setShowOperatingActorsModal] = useState(false);

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
        
        // Load dashboard meta and counts
        if (targetEvent) {
          const [meta, gapCounts] = await Promise.all([
            gapService.getDashboardMeta(targetEvent.id),
            gapService.getCounts(targetEvent.id),
          ]);
          setDashboardMeta(meta);
          setCounts(gapCounts);
        }
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

  const handleViewSignals = async (gap: GapWithDetails) => {
    setSelectedGap(gap);
    // Fetch signals for this gap
    const signals = await gapService.getSignalsForGap(gap.sector_id, gap.capacity_type_id);
    setSignalsForModal(signals);
    setShowSignalsModal(true);
  };

  const handleActivateActors = (gap: GapWithDetails) => {
    setSelectedGap(gap);
    setShowActorsDrawer(true);
  };

  const handleViewSectorDetails = (sectorId: string) => {
    // For now, open gap drawer with first gap in sector
    // In future, could open a sector-specific drawer
    console.log("View sector details:", sectorId);
  };

  const handleOpenOperatingActorsModal = async () => {
    if (!event) return;
    const actors = await gapService.getOperatingActors(event.id);
    setOperatingActors(actors);
    setShowOperatingActorsModal(true);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-10 w-full" />
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
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
      {/* Header con evento, fase, última señal, confianza */}
      <EventHeader 
        event={event} 
        phase="unstable"
        allEvents={allEvents}
        onEventChange={handleEventChange}
        lastSignal={dashboardMeta?.lastSignal}
        globalConfidence={dashboardMeta?.globalConfidence}
      />
      
      {/* Chips de filtro clickeables */}
      <FilterChips
        counts={{
          sectorsWithGaps: counts?.sectorsWithGaps || 0,
          critical: counts?.critical || 0,
          partial: counts?.partial || 0,
          operatingActors: dashboardMeta?.operatingCount || 0,
        }}
        activeFilters={activeFilters}
        onFilterChange={setActiveFilters}
        onOpenActorsModal={handleOpenOperatingActorsModal}
      />
      
      {/* Lista de sectores con gaps */}
      <SectorGapList
        eventId={event.id}
        activeFilters={activeFilters}
        onViewSectorDetails={handleViewSectorDetails}
        onViewSignals={handleViewSignals}
        onActivateActors={handleActivateActors}
      />
      
      {/* Modal de señales */}
      <SignalsModal
        gap={selectedGap}
        signals={signalsForModal}
        open={showSignalsModal}
        onOpenChange={setShowSignalsModal}
      />
      
      {/* Modal de actores operando */}
      <OperatingActorsModal
        actors={operatingActors}
        open={showOperatingActorsModal}
        onOpenChange={setShowOperatingActorsModal}
        onViewGap={(gapId) => {
          setShowOperatingActorsModal(false);
          // Could navigate to gap or open drawer
          console.log("View gap:", gapId);
        }}
      />
      
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
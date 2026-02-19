import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { eventService, gapService } from "@/services";
import { mapGapStateToNeedStatus } from "@/lib/needStatus";
import { geocodeLocation } from "@/lib/geocode";
import type { Event, Signal } from "@/types/database";
import type { GapWithDetails, GapCounts, DashboardMeta, OperatingActor, SectorWithGaps } from "@/services/gapService";
import type { EnrichedSector } from "@/services/sectorService";
import type { SeverityFilter } from "@/components/dashboard/FilterChips";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Activity } from "lucide-react";
import { MapView } from "@/components/map";
import { useSectorFocus } from "@/hooks/useSectorFocus";
import type { MapSector } from "@/components/map/types";

// Dashboard components
import { EventHeader } from "@/components/dashboard/EventHeader";
import { FilterChips } from "@/components/dashboard/FilterChips";
import { SectorGapList } from "@/components/dashboard/SectorGapList";
import { SignalsModal } from "@/components/dashboard/SignalsModal";
import { OperatingActorsModal } from "@/components/dashboard/OperatingActorsModal";
import { AvailableActorsDrawer } from "@/components/dashboard/AvailableActorsDrawer";
import { SectorDetailDrawer } from "@/components/sectors/SectorDetailDrawer";
import { ScrollToTopButton } from "@/components/ui/ScrollToTopButton";

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
  const [activeCapacityFilters, setActiveCapacityFilters] = useState<string[]>([]);
  
  // Modal/drawer states
  const [selectedGap, setSelectedGap] = useState<GapWithDetails | null>(null);
  const [signalsForModal, setSignalsForModal] = useState<Signal[]>([]);
  const [showSignalsModal, setShowSignalsModal] = useState(false);
  const [showActorsDrawer, setShowActorsDrawer] = useState(false);
  
  // Sector detail drawer
  const [selectedSector, setSelectedSector] = useState<EnrichedSector | null>(null);
  const [showSectorDrawer, setShowSectorDrawer] = useState(false);
  
  // Operating actors modal
  const [operatingActors, setOperatingActors] = useState<OperatingActor[]>([]);
  const [showOperatingActorsModal, setShowOperatingActorsModal] = useState(false);
  
  // Map data
  const [sectorsWithGaps, setSectorsWithGaps] = useState<SectorWithGaps[]>([]);
  const { focusedSectorId, highlightedCardId, setFocusedSectorId, scrollToCard } = useSectorFocus({ containerSelector: "#sector-cards-container" });
  
  // Transform sectors for map
  const mapSectors = useMemo((): MapSector[] => {
    return sectorsWithGaps.map(s => ({
      id: s.sector.id,
      name: s.sector.canonical_name,
      status: s.gapCounts.critical > 0 ? "critical" : "partial",
      lat: s.sector.latitude,
      lng: s.sector.longitude,
      gaps: s.gaps.map(g => {
        const needStatus = g.need_status ?? mapGapStateToNeedStatus(g.state);
        return {
          capabilityName: g.capacity_type?.name ?? "",
          coverage: needStatus === "RED" ? "none" as const : "partial" as const,
          severity: (needStatus === "RED" ? "critical" : "partial") as "critical" | "partial",
        };
      }),
    }));
  }, [sectorsWithGaps]);

  // Extract unique capacity types for filter dropdown
  const capacityOptions = useMemo(() => {
    const map = new Map<string, string>();
    sectorsWithGaps.forEach(s => {
      s.gaps.forEach(g => {
        if (g.capacity_type?.id && g.capacity_type?.name) {
          map.set(g.capacity_type.id, g.capacity_type.name);
        }
      });
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [sectorsWithGaps]);

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

  const handleViewSectorDetails = async (sectorId: string) => {
    const enrichedSector = await gapService.getEnrichedSectorById(sectorId);
    if (enrichedSector) {
      setSelectedSector(enrichedSector);
      setShowSectorDrawer(true);
    }
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
    <div className="h-[calc(100vh-56px)] flex flex-col animate-fade-in">
      {/* Header + Filtros - ancho completo, sticky */}
      <div className="shrink-0 p-4 pb-0 space-y-4 sticky top-0 z-10 bg-background/95 backdrop-blur-sm">
        <EventHeader 
          event={event} 
          allEvents={allEvents}
          onEventChange={handleEventChange}
        />
        
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
          capacityOptions={capacityOptions}
          activeCapacityFilters={activeCapacityFilters}
          onCapacityFilterChange={setActiveCapacityFilters}
        />
      </div>
      
      {/* Contenedor side-by-side */}
      <div className="flex-1 flex gap-4 p-4 min-h-0">
        {/* Mapa fijo izquierda, sticky */}
        <aside className="w-[300px] shrink-0 self-start sticky top-4 overflow-hidden rounded-xl shadow-lg">
          <MapView
            variant="sidebar"
            viewerRole="admin"
            orgCapabilities={[]}
            sectors={mapSectors}
            focusedSectorId={focusedSectorId}
            onSectorFocus={setFocusedSectorId}
            onSectorClick={scrollToCard}
            fallbackCenter={geocodeLocation(event?.location)}
          />
        </aside>
        
        {/* Panel derecho - scroll independiente */}
        <main id="sector-cards-container" className="flex-1 overflow-y-auto min-h-0">
          <SectorGapList
            eventId={event.id}
            activeFilters={activeFilters}
            activeCapacityFilters={activeCapacityFilters}
            onViewSectorDetails={handleViewSectorDetails}
            onViewSignals={handleViewSignals}
            onActivateActors={handleActivateActors}
            focusedSectorId={focusedSectorId}
            highlightedCardId={highlightedCardId}
            onSectorHover={setFocusedSectorId}
            onSectorsLoaded={setSectorsWithGaps}
            gridColumns={2}
          />
        </main>
      </div>
      
      {/* Botón flotante para volver arriba */}
      <ScrollToTopButton showAfter={300} containerSelector="#sector-cards-container" />
      
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
          console.log("View gap:", gapId);
        }}
      />
      
      {/* Drawer de detalle de sector (mismo que /sectors) */}
      <SectorDetailDrawer
        sector={selectedSector}
        open={showSectorDrawer}
        onOpenChange={setShowSectorDrawer}
        onEnroll={() => {}} // No-op for admin
        hideEnrollButton={true}
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
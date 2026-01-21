import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useMockAuth } from "@/hooks/useMockAuth";
import { eventService, matrixService, sectorService } from "@/services";
import { MOCK_CAPACITY_TYPES, MOCK_SECTOR_CAPABILITY_MATRIX } from "@/services/mock/data";
import type { NeedLevelExtended } from "@/services/matrixService";
import type { Event, Sector, CapacityType } from "@/types/database";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CapacityIcon } from "@/components/ui/CapacityIcon";
import { Activity, ChevronRight, MapPin, Plus } from "@/lib/icons";
import { useToast } from "@/hooks/use-toast";

export default function EventDashboard() {
  const { eventId } = useParams<{ eventId: string }>();
  const { isAdmin } = useMockAuth();
  const { toast } = useToast();
  
  const [event, setEvent] = useState<Event | null>(null);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [capacityTypes, setCapacityTypes] = useState<CapacityType[]>([]);
  const [matrix, setMatrix] = useState<Record<string, Record<string, NeedLevelExtended>>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [pendingChanges, setPendingChanges] = useState<Map<string, Map<string, NeedLevelExtended>>>(new Map());

  useEffect(() => {
    const loadData = async () => {
      try {
        // Get first active event if no eventId provided
        let targetEvent: Event | null = null;
        if (eventId) {
          targetEvent = await eventService.getById(eventId);
        } else {
          const activeEvents = await eventService.getActive();
          targetEvent = activeEvents[0] || null;
        }
        
        if (targetEvent) {
          setEvent(targetEvent);
          const eventSectors = await eventService.getSectorsForEvent(targetEvent.id);
          setSectors(eventSectors);
        }
        
        setCapacityTypes(MOCK_CAPACITY_TYPES);
        setMatrix({ ...MOCK_SECTOR_CAPABILITY_MATRIX });
      } catch (error) {
        console.error("Error loading event dashboard:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [eventId]);

  const handleCellChange = (sectorId: string, capacityId: string, level: NeedLevelExtended) => {
    // Update local state immediately
    setMatrix(prev => ({
      ...prev,
      [sectorId]: {
        ...(prev[sectorId] || {}),
        [capacityId]: level,
      },
    }));

    // Track pending changes
    setPendingChanges(prev => {
      const newChanges = new Map(prev);
      if (!newChanges.has(sectorId)) {
        newChanges.set(sectorId, new Map());
      }
      newChanges.get(sectorId)!.set(capacityId, level);
      return newChanges;
    });
  };

  const handleSave = async () => {
    // Apply all pending changes to the mock service
    for (const [sectorId, capacities] of pendingChanges) {
      for (const [capacityId, level] of capacities) {
        await matrixService.updateCell(sectorId, capacityId, level);
      }
    }

    setPendingChanges(new Map());
    toast({
      title: "Cambios guardados",
      description: "La matriz ha sido actualizada.",
    });
  };

  const hasPendingChanges = pendingChanges.size > 0;

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

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

  // Filter sectors that belong to this event
  const eventSectors = sectors.filter(s => s.event_id === event.id);

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
            <span className="font-medium">{event.name}
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{event.name}</h1>
          <div className="flex items-center gap-4 mt-2 text-muted-foreground">
            {event.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {event.location}
              </span>
            )}
            <StatusBadge
              status={event.status === "active" ? "warning" : "pending"}
              label={event.status === "active" ? "Activo" : "Cerrado"}
            />
          </div>
        </div>
        <div className="flex gap-2">
          {hasPendingChanges && (
            <Button onClick={handleSave}>
              Guardar Cambios
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link to={`/admin/coordination?event=${event.id}`}>
              <Plus className="w-4 h-4 mr-2" />
              Agregar Sector
            </Link>
          </Button>
        </div>
      </div>

      {/* Matrix */}
      <Card>
        <CardHeader>
          <CardTitle>Matriz Sector × Capacidad</CardTitle>
          <CardDescription>
            Haz clic en una celda para cambiar el nivel de necesidad
          </CardDescription>
        </CardHeader>
        <CardContent>
          {eventSectors.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MapPin className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No hay sectores definidos para este evento</p>
              <Button variant="outline" size="sm" className="mt-4" asChild>
                <Link to={`/admin/coordination?event=${event.id}`}>
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar sector
                </Link>
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="p-2 text-left font-medium text-muted-foreground border-b sticky left-0 bg-background z-10">
                      Sector
                    </th>
                    {capacityTypes.map((cap) => (
                      <th key={cap.id} className="p-2 text-center border-b min-w-[100px]">
                        <CapacityIcon name={cap.name} icon={cap.icon} size="sm" />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {eventSectors.map((sector) => (
                    <tr key={sector.id} className="hover:bg-muted/30">
                      <td className="p-2 font-medium border-b sticky left-0 bg-background z-10">
                        <div className="flex items-center gap-2">
                          <span>{sector.canonical_name}</span>
                          <StatusBadge
                            status={sector.status === "resolved" ? "covered" : "pending"}
                            size="sm"
                            showIcon={false}
                          />
                        </div>
                      </td>
                      {capacityTypes.map((cap) => {
                        const level = (matrix[sector.id]?.[cap.id] || "unknown") as NeedLevelExtended;
                        return (
                          <td key={cap.id} className="p-1 border-b">
                            <MatrixCell
                              sectorId={sector.id}
                              capacityId={cap.id}
                              level={level}
                              onChange={handleCellChange}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Leyenda</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {(["critical", "high", "medium", "low", "covered", "unknown"] as NeedLevelExtended[]).map((level) => (
              <div key={level} className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded ${matrixService.getLevelColor(level)}`} />
                <span className="text-sm">{matrixService.getLevelLabel(level)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Matrix Cell Component
function MatrixCell({
  sectorId,
  capacityId,
  level,
  onChange,
}: {
  sectorId: string;
  capacityId: string;
  level: NeedLevelExtended;
  onChange: (sectorId: string, capacityId: string, level: NeedLevelExtended) => void;
}) {
  const levels: NeedLevelExtended[] = ["unknown", "low", "medium", "high", "critical", "covered"];
  
  return (
    <Select
      value={level}
      onValueChange={(value) => onChange(sectorId, capacityId, value as NeedLevelExtended)}
    >
      <SelectTrigger 
        className={`w-full h-10 border-0 ${matrixService.getLevelColor(level)}`}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {levels.map((l) => (
          <SelectItem key={l} value={l}>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded ${matrixService.getLevelColor(l)}`} />
              <span>{matrixService.getLevelLabel(l)}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

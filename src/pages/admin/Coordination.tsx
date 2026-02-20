import { useEffect, useState } from "react";
import { useSearchParams, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { eventService } from "@/services";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CapacityIcon } from "@/components/ui/CapacityIcon";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Activity, MapPin, Plus, Shield } from "@/lib/icons";
import type { Event, Sector, CapacityType, NeedLevel } from "@/types/database";

export default function Coordination() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const preselectedEventId = searchParams.get("event");

  const [events, setEvents] = useState<Event[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [capacityTypes, setCapacityTypes] = useState<CapacityType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form state for new event
  const [newEventName, setNewEventName] = useState("");
  const [newEventLocation, setNewEventLocation] = useState("");
  const [newEventDescription, setNewEventDescription] = useState("");
  const [newEventPopulationAffected, setNewEventPopulationAffected] = useState("");

  // Form state for new sector
  const [selectedEventForSector, setSelectedEventForSector] = useState(preselectedEventId || "");
  const [newSectorName, setNewSectorName] = useState("");
  const [sectorAliases, setSectorAliases] = useState("");

  // Form state for contextual demand
  const [selectedEventForDemand, setSelectedEventForDemand] = useState(preselectedEventId || "");
  const [selectedSector, setSelectedSector] = useState("");
  const [selectedCapacity, setSelectedCapacity] = useState("");
  const [demandLevel, setDemandLevel] = useState<NeedLevel>("medium");
  const [demandSource, setDemandSource] = useState("");
  const [demandNotes, setDemandNotes] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [eventsData, capacitiesData] = await Promise.all([
          eventService.getAll(),
          eventService.getCapacityTypes(),
        ]);

        setEvents(eventsData);
        setCapacityTypes(capacitiesData);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    const eventId = selectedEventForDemand || selectedEventForSector;
    if (eventId) {
      eventService.getSectorsForEvent(eventId).then(setSectors).catch(console.error);
    } else {
      setSectors([]);
    }
  }, [selectedEventForDemand, selectedEventForSector]);

  const handleCreateEvent = async () => {
    if (!newEventName.trim()) return;

    setIsSaving(true);
    try {
      await eventService.create({
        name: newEventName.trim(),
        population_affected: newEventPopulationAffected ? Number(newEventPopulationAffected) : null,
        type: null,
        location: newEventLocation.trim() || null,
        description: newEventDescription.trim() || null,
        status: "active",
        started_at: new Date().toISOString(),
        ended_at: null,
        created_by: null,
      });

      toast({
        title: "Evento creado",
        description: `El evento "${newEventName}" ha sido creado exitosamente.`,
      });

      // Reset form and refresh
      setNewEventName("");
      setNewEventLocation("");
      setNewEventDescription("");
      setNewEventPopulationAffected("");
      const updatedEvents = await eventService.getAll();
      setEvents(updatedEvents);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el evento",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateSector = async () => {
    if (!selectedEventForSector || !newSectorName.trim()) return;

    setIsSaving(true);
    try {
      const aliases = sectorAliases
        .split(",")
        .map((a) => a.trim())
        .filter((a) => a);

      await eventService.addSector(
        selectedEventForSector,
        newSectorName.trim(),
        aliases.length > 0 ? aliases : undefined,
      );

      toast({
        title: "Sector creado",
        description: `El sector "${newSectorName}" ha sido agregado.`,
      });

      // Reset form
      setNewSectorName("");
      setSectorAliases("");

      // Refresh sectors
      const updatedSectors = await eventService.getSectorsForEvent(selectedEventForSector);
      setSectors(updatedSectors);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el sector",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddContextualDemand = async () => {
    if (!selectedEventForDemand || !selectedSector || !selectedCapacity || !demandSource.trim()) return;

    setIsSaving(true);
    try {
      await eventService.addContextualDemand({
        eventId: selectedEventForDemand,
        sectorId: selectedSector,
        capacityTypeId: selectedCapacity,
        level: demandLevel,
        source: demandSource,
        notes: demandNotes.trim() || undefined,
      });

      toast({
        title: "Demanda agregada",
        description: "La demanda contextual ha sido registrada.",
      });

      // Reset form
      setSelectedCapacity("");
      setDemandLevel("medium");
      setDemandSource("");
      setDemandNotes("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo agregar la demanda",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Shield className="w-8 h-8 text-primary" />
          Coordinación
        </h1>
        <p className="text-muted-foreground mt-1">
          Gestiona eventos, sectores y demanda contextual
        </p>
      </div>

      <Tabs defaultValue="events" className="w-full">
        <TabsList>
          <TabsTrigger value="events">Eventos</TabsTrigger>
          <TabsTrigger value="sectors">Sectores</TabsTrigger>
          <TabsTrigger value="demand">Demanda Contextual</TabsTrigger>
        </TabsList>

        {/* Events Tab */}
        <TabsContent value="events" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Crear Nuevo Evento
                </CardTitle>
                <CardDescription>
                  Inicia un nuevo evento de emergencia
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="eventName">Nombre del evento *</Label>
                  <Input
                    id="eventName"
                    value={newEventName}
                    onChange={(e) => setNewEventName(e.target.value)}
                    placeholder="Ej: Incendio Zona Norte"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eventLocation">Ubicación</Label>
                  <Input
                    id="eventLocation"
                    value={newEventLocation}
                    onChange={(e) => setNewEventLocation(e.target.value)}
                    placeholder="Ej: Región de Valparaíso"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eventDesc">Descripción</Label>
                  <Textarea
                    id="eventDesc"
                    value={newEventDescription}
                    onChange={(e) => setNewEventDescription(e.target.value)}
                    placeholder="Descripción del evento..."
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eventPopulationAffected">Población afectada (evento)</Label>
                  <Input
                    id="eventPopulationAffected"
                    type="number"
                    min={0}
                    value={newEventPopulationAffected}
                    onChange={(e) => setNewEventPopulationAffected(e.target.value)}
                    placeholder="Ej: 12000"
                  />
                </div>
                <Button onClick={handleCreateEvent} disabled={!newEventName.trim() || isSaving}>
                  {isSaving ? "Creando..." : "Crear Evento"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Eventos Existentes</CardTitle>
                <CardDescription>
                  {events.length} evento(s) en el sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                {events.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No hay eventos creados
                  </p>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {events.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Activity
                            className={`w-5 h-5 ${
                              event.status === "active" ? "text-warning" : "text-muted-foreground"
                            }`}
                          />
                          <div>
                            <p className="font-medium">{event.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {event.location || "Sin ubicación"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Población afectada: {event.population_affected?.toLocaleString() ?? "Sin dato"}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            event.status === "active"
                              ? "bg-warning/20 text-warning"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {event.status === "active" ? "Activo" : "Cerrado"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Sectors Tab */}
        <TabsContent value="sectors" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Agregar Sector
              </CardTitle>
              <CardDescription>
                Define un nuevo sector operativo para un evento
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Evento *</Label>
                  <Select value={selectedEventForSector} onValueChange={setSelectedEventForSector}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar evento" />
                    </SelectTrigger>
                    <SelectContent>
                      {events
                        .filter((e) => e.status === "active")
                        .map((event) => (
                          <SelectItem key={event.id} value={event.id}>
                            {event.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sectorName">Nombre del sector *</Label>
                  <Input
                    id="sectorName"
                    value={newSectorName}
                    onChange={(e) => setNewSectorName(e.target.value)}
                    placeholder="Ej: Cerro El Vergel"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sectorAliases">Alias (separados por coma)</Label>
                <Input
                  id="sectorAliases"
                  value={sectorAliases}
                  onChange={(e) => setSectorAliases(e.target.value)}
                  placeholder="Ej: El Vergel, Sector 5, Zona Alta"
                />
              </div>
              <Button
                onClick={handleCreateSector}
                disabled={!selectedEventForSector || !newSectorName.trim() || isSaving}
              >
                {isSaving ? "Creando..." : "Agregar Sector"}
              </Button>

              {sectors.length > 0 && (
                <div className="mt-6">
                  <p className="text-sm font-medium mb-3">
                    Sectores del evento seleccionado ({sectors.length})
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {sectors.map((sector) => (
                      <div
                        key={sector.id}
                        className="p-2 rounded border border-border text-sm"
                      >
                        {sector.canonical_name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contextual Demand Tab */}
        <TabsContent value="demand" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-demand-context">
                Agregar Demanda Contextual
              </CardTitle>
              <CardDescription>
                Registra necesidades basadas en reportes oficiales, observación en terreno o criterio experto
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Evento *</Label>
                  <Select value={selectedEventForDemand} onValueChange={setSelectedEventForDemand}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar evento" />
                    </SelectTrigger>
                    <SelectContent>
                      {events
                        .filter((e) => e.status === "active")
                        .map((event) => (
                          <SelectItem key={event.id} value={event.id}>
                            {event.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Sector *</Label>
                  <Select
                    value={selectedSector}
                    onValueChange={setSelectedSector}
                    disabled={!selectedEventForDemand}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar sector" />
                    </SelectTrigger>
                    <SelectContent>
                      {sectors.map((sector) => (
                        <SelectItem key={sector.id} value={sector.id}>
                          {sector.canonical_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Capacidad requerida *</Label>
                  <Select value={selectedCapacity} onValueChange={setSelectedCapacity}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar capacidad" />
                    </SelectTrigger>
                    <SelectContent>
                      {capacityTypes.map((ct) => (
                        <SelectItem key={ct.id} value={ct.id}>
                          <div className="flex items-center gap-2">
                            <CapacityIcon name={ct.name} icon={ct.icon} size="sm" />
                            <span className="capitalize">{ct.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Nivel de necesidad</Label>
                  <Select value={demandLevel} onValueChange={(v) => setDemandLevel(v as NeedLevel)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Bajo</SelectItem>
                      <SelectItem value="medium">Medio</SelectItem>
                      <SelectItem value="high">Alto</SelectItem>
                      <SelectItem value="critical">Crítico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="demandSource">Fuente de información *</Label>
                <Select value={demandSource} onValueChange={setDemandSource}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar fuente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reporte_oficial">Reporte oficial</SelectItem>
                    <SelectItem value="terreno">Observación en terreno</SelectItem>
                    <SelectItem value="pronostico">Pronóstico/Predicción</SelectItem>
                    <SelectItem value="criterio_experto">Criterio experto</SelectItem>
                    <SelectItem value="otro">Otra fuente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="demandNotes">Notas adicionales</Label>
                <Textarea
                  id="demandNotes"
                  value={demandNotes}
                  onChange={(e) => setDemandNotes(e.target.value)}
                  placeholder="Información adicional sobre esta necesidad..."
                  rows={3}
                />
              </div>

              <Button
                onClick={handleAddContextualDemand}
                className="bg-demand-context hover:bg-demand-context/90"
                disabled={
                  !selectedEventForDemand ||
                  !selectedSector ||
                  !selectedCapacity ||
                  !demandSource ||
                  isSaving
                }
              >
                {isSaving ? "Agregando..." : "Agregar Demanda Contextual"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

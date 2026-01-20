import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CapacityIcon } from "@/components/ui/CapacityIcon";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle, Filter, MapPin, Plus, Search, Users } from "@/lib/icons";
import type { Event, Sector, CapacityType, ActorCapability, SectorGap, NeedLevel } from "@/types/database";

interface RecommendedSector {
  sector: Sector;
  event: Event;
  gaps: SectorGap[];
  relevantGaps: SectorGap[]; // Only gaps matching user's capabilities
}

export default function Sectors() {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [events, setEvents] = useState<Event[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [capacityTypes, setCapacityTypes] = useState<CapacityType[]>([]);
  const [myCapabilities, setMyCapabilities] = useState<ActorCapability[]>([]);
  const [recommendedSectors, setRecommendedSectors] = useState<RecommendedSector[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<string>("all");
  const [isDeploying, setIsDeploying] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch all necessary data
        const [eventsRes, capacitiesRes, capabilitiesRes] = await Promise.all([
          supabase.from("events").select("*").eq("status", "active"),
          supabase.from("capacity_types").select("*"),
          user
            ? supabase.from("actor_capabilities").select("*").eq("user_id", user.id)
            : Promise.resolve({ data: [] }),
        ]);

        setEvents(eventsRes.data || []);
        setCapacityTypes(capacitiesRes.data || []);
        setMyCapabilities(capabilitiesRes.data || []);

        // For each active event, fetch sectors and calculate gaps
        const allRecommended: RecommendedSector[] = [];

        for (const event of eventsRes.data || []) {
          const [sectorsRes, smsNeedsRes, contextNeedsRes, deploymentsRes] = await Promise.all([
            supabase.from("sectors").select("*").eq("event_id", event.id),
            supabase.from("sector_needs_sms").select("*").eq("event_id", event.id),
            supabase.from("sector_needs_context").select("*").eq("event_id", event.id),
            supabase.from("deployments").select("*").eq("event_id", event.id).in("status", ["planned", "active"]),
          ]);

          for (const sector of sectorsRes.data || []) {
            const gaps: SectorGap[] = [];

            for (const capacity of capacitiesRes.data || []) {
              const smsNeeds = (smsNeedsRes.data || []).filter(
                (n) => n.sector_id === sector.id && n.capacity_type_id === capacity.id
              );
              const contextNeeds = (contextNeedsRes.data || []).filter(
                (n) => n.sector_id === sector.id && n.capacity_type_id === capacity.id
              );
              const deployments = (deploymentsRes.data || []).filter(
                (d) => d.sector_id === sector.id && d.capacity_type_id === capacity.id
              );

              const smsDemand = smsNeeds.reduce((sum, n) => sum + n.count, 0);
              const contextDemand = contextNeeds.length;
              const totalDemand = smsDemand + contextDemand;
              const coverage = deployments.length;
              const gap = Math.max(0, totalDemand - coverage);

              if (totalDemand > 0 && gap > 0) {
                const allLevels = [...smsNeeds.map((n) => n.level), ...contextNeeds.map((n) => n.level)];
                const levelOrder: NeedLevel[] = ["low", "medium", "high", "critical"];
                const maxLevel = allLevels.reduce((max, level) => {
                  return levelOrder.indexOf(level as NeedLevel) > levelOrder.indexOf(max)
                    ? (level as NeedLevel)
                    : max;
                }, "low" as NeedLevel);

                gaps.push({
                  sector,
                  capacityType: capacity,
                  smsDemand,
                  contextDemand,
                  totalDemand,
                  coverage,
                  gap,
                  isUncovered: coverage === 0,
                  isCritical: maxLevel === "critical" || maxLevel === "high",
                  maxLevel,
                });
              }
            }

            if (gaps.length > 0) {
              // Filter gaps to those matching user's capabilities
              const myCapabilityIds = (capabilitiesRes.data || [])
                .filter((c) => c.availability !== "unavailable")
                .map((c) => c.capacity_type_id);

              const relevantGaps = gaps.filter((g) => myCapabilityIds.includes(g.capacityType.id));

              allRecommended.push({
                sector,
                event,
                gaps,
                relevantGaps,
              });
            }
          }
        }

        // Sort by urgency (critical first, then by gap size)
        allRecommended.sort((a, b) => {
          const aMaxCritical = a.gaps.some((g) => g.isCritical);
          const bMaxCritical = b.gaps.some((g) => g.isCritical);
          if (aMaxCritical && !bMaxCritical) return -1;
          if (!aMaxCritical && bMaxCritical) return 1;

          const aMaxGap = Math.max(...a.gaps.map((g) => g.gap));
          const bMaxGap = Math.max(...b.gaps.map((g) => g.gap));
          return bMaxGap - aMaxGap;
        });

        setRecommendedSectors(allRecommended);
        setSectors(allRecommended.map((r) => r.sector));
      } catch (error) {
        console.error("Error fetching sectors:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const handleDeploy = async (sectorId: string, eventId: string, capacityTypeId: string) => {
    if (!user) return;

    setIsDeploying(`${sectorId}-${capacityTypeId}`);

    try {
      const { error } = await supabase.from("deployments").insert({
        event_id: eventId,
        sector_id: sectorId,
        capacity_type_id: capacityTypeId,
        actor_id: user.id,
        status: "planned",
      });

      if (error) throw error;

      toast({
        title: "Inscripción exitosa",
        description: "Te has inscrito en este sector. Tu despliegue está marcado como 'planificado'.",
      });

      // Refresh data
      window.location.reload();
    } catch (error: any) {
      toast({
        title: "Error al inscribirse",
        description: error.message || "No se pudo completar la inscripción",
        variant: "destructive",
      });
    } finally {
      setIsDeploying(null);
    }
  };

  // Filter sectors
  const filteredSectors = recommendedSectors.filter((rec) => {
    const matchesSearch = rec.sector.canonical_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesEvent = selectedEvent === "all" || rec.event.id === selectedEvent;
    return matchesSearch && matchesEvent;
  });

  // Separate by relevance to user's capabilities
  const relevantSectors = filteredSectors.filter((r) => r.relevantGaps.length > 0);
  const otherSectors = filteredSectors.filter((r) => r.relevantGaps.length === 0);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Sectores Recomendados</h1>
        <p className="text-muted-foreground mt-1">
          Sectores con brechas donde puedes aportar según tus capacidades
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar sectores..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedEvent} onValueChange={setSelectedEvent}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Filtrar por evento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los eventos</SelectItem>
            {events.map((event) => (
              <SelectItem key={event.id} value={event.id}>
                {event.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* My Capabilities Summary */}
      {!isAdmin && myCapabilities.length === 0 && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="flex items-center gap-4 py-4">
            <AlertTriangle className="w-8 h-8 text-warning" />
            <div className="flex-1">
              <p className="font-medium">No tienes capacidades registradas</p>
              <p className="text-sm text-muted-foreground">
                Agrega tus capacidades para ver sectores recomendados específicos para ti.
              </p>
            </div>
            <Button asChild>
              <Link to="/my-capabilities">
                <Plus className="w-4 h-4 mr-2" />
                Agregar Capacidades
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Relevant Sectors (matching user's capabilities) */}
      {relevantSectors.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-coverage" />
            Para tus capacidades ({relevantSectors.length})
          </h2>
          <div className="grid gap-4">
            {relevantSectors.map((rec) => (
              <SectorCard
                key={rec.sector.id}
                recommendation={rec}
                onDeploy={handleDeploy}
                isDeploying={isDeploying}
                isRelevant
              />
            ))}
          </div>
        </div>
      )}

      {/* Other Sectors */}
      {otherSectors.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4 text-muted-foreground">
            Otros sectores con brechas ({otherSectors.length})
          </h2>
          <div className="grid gap-4">
            {otherSectors.map((rec) => (
              <SectorCard
                key={rec.sector.id}
                recommendation={rec}
                onDeploy={handleDeploy}
                isDeploying={isDeploying}
                isRelevant={false}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredSectors.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <MapPin className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No hay sectores con brechas</h3>
            <p className="text-muted-foreground max-w-md">
              {searchQuery || selectedEvent !== "all"
                ? "No se encontraron sectores que coincidan con los filtros."
                : "Actualmente todos los sectores tienen cobertura adecuada."}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SectorCard({
  recommendation,
  onDeploy,
  isDeploying,
  isRelevant,
}: {
  recommendation: RecommendedSector;
  onDeploy: (sectorId: string, eventId: string, capacityTypeId: string) => void;
  isDeploying: string | null;
  isRelevant: boolean;
}) {
  const { sector, event, gaps, relevantGaps } = recommendation;
  const displayGaps = isRelevant ? relevantGaps : gaps.slice(0, 4);
  const hasCritical = gaps.some((g) => g.isCritical);

  return (
    <Card className={hasCritical ? "border-gap-critical/30" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                hasCritical ? "bg-gap-critical/20" : "bg-primary/10"
              }`}
            >
              <MapPin className={`w-5 h-5 ${hasCritical ? "text-gap-critical" : "text-primary"}`} />
            </div>
            <div>
              <CardTitle className="text-lg">{sector.canonical_name}</CardTitle>
              <CardDescription>
                Evento: {event.name} • {event.location || "Sin ubicación"}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasCritical && <StatusBadge status="critical" label="Crítico" size="sm" pulse />}
            <StatusBadge
              status={sector.status === "resolved" ? "covered" : "pending"}
              label={sector.status}
              size="sm"
              showIcon={false}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {displayGaps.map((gap) => (
            <div
              key={gap.capacityType.id}
              className={`p-3 rounded-lg border ${
                gap.isCritical
                  ? "border-gap-critical/50 bg-gap-critical/5"
                  : "border-border bg-card"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <CapacityIcon
                  name={gap.capacityType.name}
                  icon={gap.capacityType.icon}
                  size="sm"
                  showLabel
                />
                {gap.isCritical && (
                  <AlertTriangle className="w-4 h-4 text-gap-critical" />
                )}
              </div>
              <div className="space-y-1 text-sm mb-3">
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
                  <span className="font-mono text-gap-critical">{gap.gap}</span>
                </div>
              </div>
              <Button
                size="sm"
                className="w-full"
                variant={gap.isCritical ? "destructive" : "default"}
                onClick={() => onDeploy(sector.id, event.id, gap.capacityType.id)}
                disabled={isDeploying === `${sector.id}-${gap.capacityType.id}`}
              >
                {isDeploying === `${sector.id}-${gap.capacityType.id}` ? (
                  "Inscribiendo..."
                ) : (
                  <>
                    <Users className="w-4 h-4 mr-1" />
                    Inscribirme
                  </>
                )}
              </Button>
            </div>
          ))}
        </div>
        {gaps.length > displayGaps.length && (
          <p className="text-sm text-muted-foreground mt-3 text-center">
            +{gaps.length - displayGaps.length} capacidades más con brechas
          </p>
        )}
      </CardContent>
    </Card>
  );
}

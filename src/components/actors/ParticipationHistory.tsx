import { useState, useEffect } from "react";
import { Calendar, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { actorNetworkService } from "@/services/actorNetworkService";
import type { ActorParticipationHistory as HistoryType } from "@/types/database";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface ParticipationHistoryProps {
  actorId: string;
}

export function ParticipationHistory({ actorId }: ParticipationHistoryProps) {
  const [history, setHistory] = useState<HistoryType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await actorNetworkService.getParticipationHistory(actorId);
        setHistory(data);
      } catch (error) {
        console.error("Failed to load history", error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [actorId]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando historial...</p>;
  }

  if (history.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        Sin participación en eventos anteriores
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {history.map((event, idx) => (
        <div key={idx} className="p-3 bg-muted/50 rounded-lg">
          <div className="flex items-start justify-between">
            <h4 className="font-medium text-sm">{event.event_name}</h4>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>
                {format(new Date(event.started_at), "MMM yyyy", { locale: es })}
              </span>
            </div>
          </div>

          {/* Capacities activated */}
          {event.capacities_activated.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {event.capacities_activated.map((cap, capIdx) => (
                <Badge key={capIdx} variant="secondary" className="text-xs">
                  {cap}
                </Badge>
              ))}
            </div>
          )}

          {/* Sectors */}
          {event.sectors_operated.length > 0 && (
            <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span>{event.sectors_operated.join(", ")}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
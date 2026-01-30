import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronDown, Clock, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { getEventPhaseConfig, type EventPhase } from "@/lib/stateTransitions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Event, Signal } from "@/types/database";

interface EventHeaderProps {
  event: Event;
  phase?: EventPhase;
  allEvents?: Event[];
  onEventChange?: (eventId: string) => void;
  lastSignal?: Signal | null;
  globalConfidence?: "high" | "medium" | "low";
}

const CONFIDENCE_CONFIG = {
  high: { label: "Alta", bg: "bg-coverage/20", text: "text-coverage" },
  medium: { label: "Media", bg: "bg-warning/20", text: "text-warning" },
  low: { label: "Baja", bg: "bg-muted", text: "text-muted-foreground" },
};

export function EventHeader({
  event,
  phase = "unstable",
  allEvents = [],
  onEventChange,
  lastSignal,
  globalConfidence = "medium",
}: EventHeaderProps) {
  const phaseConfig = getEventPhaseConfig(phase);
  const otherEvents = allEvents.filter((e) => e.id !== event.id && e.status === "active");
  const confidenceConfig = CONFIDENCE_CONFIG[globalConfidence];

  const lastSignalTime = lastSignal
    ? formatDistanceToNow(new Date(lastSignal.created_at), {
        addSuffix: true,
        locale: es,
      })
    : null;

  return (
    <div className="space-y-2">
      {/* Event name and location */}
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold tracking-tight">{event.name}</h1>
        {event.location && <span className="text-lg text-muted-foreground">— {event.location}</span>}
      </div>

      {/* Phase badge, meta info, and event switcher */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Phase badge */}
        <div
          className={cn(
            "inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium",
            phaseConfig.bg,
            phaseConfig.text,
          )}
        >
          <span>{phaseConfig.emoji}</span>
          <span>{phaseConfig.label}</span>
        </div>

        {/* Last signal timestamp */}
        {lastSignalTime && (
          <Badge variant="outline" className="font-normal text-muted-foreground">
            <Clock className="w-3 h-3 mr-1.5" />
            Last signal {lastSignalTime}
          </Badge>
        )}

        {/* Global confidence */}
        <Badge variant="outline" className={cn("font-normal", confidenceConfig.bg, confidenceConfig.text)}>
          <ShieldCheck className="w-3 h-3 mr-1.5" />
          Confidence {confidenceConfig.label}
        </Badge>

        {/* Event switcher */}
        {otherEvents.length > 0 && onEventChange && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                Change event
                <ChevronDown className="w-4 h-4 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {otherEvents.map((e) => (
                <DropdownMenuItem key={e.id} onClick={() => onEventChange(e.id)}>
                  {e.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getEventPhaseConfig, type EventPhase } from "@/lib/stateTransitions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import type { Event } from "@/types/database";

interface EventHeaderProps {
  event: Event;
  phase?: EventPhase;
  allEvents?: Event[];
  onEventChange?: (eventId: string) => void;
}

export function EventHeader({ 
  event, 
  phase = "unstable",
  allEvents = [],
  onEventChange,
}: EventHeaderProps) {
  const phaseConfig = getEventPhaseConfig(phase);
  const otherEvents = allEvents.filter(e => e.id !== event.id && e.status === "active");

  return (
    <div className="space-y-1">
      {/* Event name and location */}
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold tracking-tight">
          {event.name}
        </h1>
        {event.location && (
          <span className="text-lg text-muted-foreground">
            — {event.location}
          </span>
        )}
      </div>

      {/* Phase badge and event switcher */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Phase badge */}
        <div className={cn(
          "inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium",
          phaseConfig.bg,
          phaseConfig.text
        )}>
          <span>{phaseConfig.emoji}</span>
          <span>{phaseConfig.label}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground font-normal">Coordinación en curso</span>
        </div>

        {/* Event switcher */}
        {otherEvents.length > 0 && onEventChange && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                Cambiar evento
                <ChevronDown className="w-4 h-4 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {otherEvents.map(e => (
                <DropdownMenuItem 
                  key={e.id}
                  onClick={() => onEventChange(e.id)}
                >
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

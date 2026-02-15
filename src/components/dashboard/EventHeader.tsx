import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Event } from "@/types/database";

interface EventHeaderProps {
  event: Event;
  allEvents?: Event[];
  onEventChange?: (eventId: string) => void;
}

export function EventHeader({
  event,
  allEvents = [],
  onEventChange,
}: EventHeaderProps) {
  const otherEvents = allEvents.filter((e) => e.id !== event.id && e.status === "active");
  const hasOtherEvents = otherEvents.length > 0 && onEventChange;

  if (!hasOtherEvents) {
    return (
      <h1 className="text-2xl font-bold tracking-tight">{event.name}</h1>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 text-2xl font-bold tracking-tight hover:text-primary transition-colors focus:outline-none">
          {event.name}
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="bg-popover">
        {otherEvents.map((e) => (
          <DropdownMenuItem key={e.id} onClick={() => onEventChange!(e.id)}>
            {e.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

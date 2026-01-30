import { MapPin, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ActorHabitualZone } from "@/types/database";

interface HabitualZonesListProps {
  zones: ActorHabitualZone[];
  onRemove: (zoneId: string) => void;
}

export function HabitualZonesList({ zones, onRemove }: HabitualZonesListProps) {
  if (zones.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        No hay zonas habituales definidas
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {zones.map((zone) => (
        <div
          key={zone.id}
          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
        >
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <div>
              <span className="text-sm font-medium">{zone.region}</span>
              {zone.commune && (
                <span className="text-sm text-muted-foreground">
                  {" "}
                  — {zone.commune}
                </span>
              )}
            </div>
            <Badge variant="outline" className="text-xs ml-2">
              {zone.presence_type === "habitual" ? "Habitual" : "Ocasional"}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => onRemove(zone.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}
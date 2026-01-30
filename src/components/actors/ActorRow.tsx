import { Building2, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ActorWithDetails } from "@/types/database";
import { ACTOR_TYPE_LABELS } from "@/types/database";

interface ActorRowProps {
  actor: ActorWithDetails;
  onView: () => void;
}

export function ActorRow({ actor, onView }: ActorRowProps) {
  const { actor: actorData, capabilities, zones, capacityTypeNames } = actor;

  // Get top 3 capabilities
  const topCapabilities = capabilities.slice(0, 3).map(
    (cap) => capacityTypeNames[cap.capacity_type_id] || "Capacidad"
  );

  // Get unique regions
  const uniqueRegions = [...new Set(zones.map((z) => z.region))].slice(0, 2);

  return (
    <Card className="p-4 hover:bg-muted/30 transition-colors">
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="p-2 bg-muted rounded-lg shrink-0">
          <Building2 className="h-5 w-5 text-muted-foreground" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium truncate">{actorData.organization_name}</h3>
            <Badge variant="outline" className="text-xs font-normal">
              {ACTOR_TYPE_LABELS[actorData.organization_type]}
            </Badge>
          </div>

          {/* Capabilities */}
          {topCapabilities.length > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              {topCapabilities.join(", ")}
              {capabilities.length > 3 && ` +${capabilities.length - 3}`}
            </p>
          )}

          {/* Zones and Status */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {uniqueRegions.length > 0 && (
              <span className="text-sm text-muted-foreground">
                {uniqueRegions.join(", ")}
                {zones.length > 2 && ` +${zones.length - 2}`}
              </span>
            )}
            <Badge
              variant={actorData.structural_status === "active" ? "default" : "secondary"}
              className={
                actorData.structural_status === "active"
                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0"
                  : ""
              }
            >
              {actorData.structural_status === "active" ? "Activo" : "Inactivo"}
            </Badge>
          </div>
        </div>

        {/* CTA */}
        <Button variant="ghost" size="sm" onClick={onView} className="shrink-0">
          Ver ficha
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </Card>
  );
}
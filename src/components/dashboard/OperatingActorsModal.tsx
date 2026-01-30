import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Phone, Mail, MapPin, Activity, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { OperatingActor } from "@/services/gapService";

interface OperatingActorsModalProps {
  actors: OperatingActor[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onViewGap?: (gapId: string) => void;
}

const ACTOR_TYPE_LABELS: Record<string, string> = {
  ong: "ONG",
  state: "Estado",
  private: "Privado",
  volunteer: "Voluntariado",
};

export function OperatingActorsModal({ actors, open, onOpenChange, onViewGap }: OperatingActorsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-coverage" />
            Organizations operating
          </DialogTitle>
          <DialogDescription>Organizations currently deployed</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 pr-4">
            {actors.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No actors are currently operating</p>
            ) : (
              actors.map((actor, index) => (
                <div key={actor.id}>
                  {index > 0 && <Separator className="mb-4" />}
                  <ActorItem actor={actor} onViewGap={onViewGap} />
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Warning footer */}
        <Alert variant="default" className="mt-4 bg-muted/50">
          <AlertDescription className="text-sm text-muted-foreground">
            The presence of organizations does not necessarily mean gaps are contained.
          </AlertDescription>
        </Alert>
      </DialogContent>
    </Dialog>
  );
}

interface ActorItemProps {
  actor: OperatingActor;
  onViewGap?: (gapId: string) => void;
}

function ActorItem({ actor, onViewGap }: ActorItemProps) {
  const lastConfirmed = actor.lastConfirmation
    ? formatDistanceToNow(new Date(actor.lastConfirmation), {
        addSuffix: true,
        locale: es,
      })
    : null;

  return (
    <div className="space-y-3">
      {/* Header: Name + Type */}
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-medium text-foreground">{actor.name}</h4>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-xs">
              {ACTOR_TYPE_LABELS[actor.type] || actor.type}
            </Badge>
            <Badge variant="outline" className="text-xs text-coverage border-coverage/50">
              <Activity className="w-3 h-3 mr-1" />
              Operating
            </Badge>
          </div>
        </div>
      </div>

      {/* Sectors and capacity */}
      <div className="text-sm space-y-1">
        <div className="flex items-center gap-2 text-muted-foreground">
          <MapPin className="w-4 h-4 shrink-0" />
          <span>{actor.sectors.length > 0 ? actor.sectors.join(", ") : "Sin sector asignado"}</span>
        </div>
        <p className="text-foreground">
          <span className="text-muted-foreground">Capability: </span>
          {actor.capacity}
        </p>
        {lastConfirmed && <p className="text-muted-foreground text-xs">Last confirmation: {lastConfirmed}</p>}
      </div>

      {/* Contact info */}
      {actor.contact && (
        <div className="bg-muted/30 rounded-md p-3 space-y-2">
          <p className="text-sm font-medium">
            {actor.contact.name}
            {actor.contact.role && <span className="text-muted-foreground font-normal"> · {actor.contact.role}</span>}
          </p>
          <div className="flex flex-wrap gap-3 text-sm">
            {actor.contact.phone && (
              <a href={`tel:${actor.contact.phone}`} className="flex items-center gap-1 text-primary hover:underline">
                <Phone className="w-3 h-3" />
                {actor.contact.phone}
              </a>
            )}
            {actor.contact.email && (
              <a
                href={`mailto:${actor.contact.email}`}
                className="flex items-center gap-1 text-primary hover:underline"
              >
                <Mail className="w-3 h-3" />
                {actor.contact.email}
              </a>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {actor.contact?.phone && (
          <Button variant="outline" size="sm" asChild>
            <a href={`tel:${actor.contact.phone}`}>
              <Phone className="w-4 h-4 mr-1" />
              Contactar
            </a>
          </Button>
        )}
        {actor.gapId && onViewGap && (
          <Button variant="ghost" size="sm" onClick={() => onViewGap(actor.gapId!)}>
            <ExternalLink className="w-4 h-4 mr-1" />
            See asociated gap
          </Button>
        )}
      </div>
    </div>
  );
}

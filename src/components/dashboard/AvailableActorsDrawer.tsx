import { useEffect, useState } from "react";
import { AlertTriangle, Building2, Check, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { GapWithDetails } from "@/services/gapService";
import type { ActorCapability } from "@/types/database";

interface AvailableActorsDrawerProps {
  gap: GapWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ActorWithCapability {
  actorId: string;
  actorName: string;
  capability: ActorCapability;
  capacityTypeName: string;
}

export function AvailableActorsDrawer({ 
  gap, 
  open, 
  onOpenChange,
}: AvailableActorsDrawerProps) {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [actors, setActors] = useState<ActorWithCapability[]>([]);
  const [invitedActors, setInvitedActors] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (gap && open) {
      const fetchActors = async () => {
        const { data: caps } = await supabase
          .from("actor_capabilities")
          .select("*, capacity_types(name)")
          .eq("capacity_type_id", gap.capacity_type_id ?? "")
          .neq("availability", "unavailable");

        if (!caps || caps.length === 0) {
          setActors([]);
          return;
        }

        const userIds = caps.map((c) => c.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, organization_name")
          .in("user_id", userIds);

        const profileMap = new Map<string, { full_name: string | null; organization_name: string | null }>();
        (profiles ?? []).forEach((p) => profileMap.set(p.user_id, p));

        type CapWithType = typeof caps[number] & { capacity_types: { name: string } | null };
        const matchingActors = (caps as CapWithType[]).map((cap) => {
          const profile = profileMap.get(cap.user_id);
          const actorName = profile?.organization_name ?? profile?.full_name ?? cap.user_id;
          const capTypeName = cap.capacity_types?.name ?? "Capacidad";
          // Map DB row to ActorCapability shape (cap already matches ActorCapability fields)
          const capability: ActorCapability = {
            id: cap.id,
            user_id: cap.user_id,
            capacity_type_id: cap.capacity_type_id,
            quantity: cap.quantity,
            unit: cap.unit,
            availability: cap.availability as ActorCapability["availability"],
            notes: cap.notes,
            created_at: cap.created_at,
            updated_at: cap.updated_at,
          };
          return {
            actorId: cap.user_id,
            actorName,
            capability,
            capacityTypeName: capTypeName,
          };
        });

        setActors(matchingActors);
        setInvitedActors(new Set());
      };

      fetchActors();
    }
  }, [gap, open]);

  const handleInvite = (actorId: string, actorName: string) => {
    setInvitedActors(prev => new Set(prev).add(actorId));
    toast({
      title: "Invitación enviada",
      description: `Se invitó a ${actorName} a coordinar`,
    });
  };

  const availabilityLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
    ready: { label: "Disponible", variant: "default" },
    limited: { label: "Limitado", variant: "secondary" },
    unavailable: { label: "No disponible", variant: "destructive" },
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Actores disponibles</SheetTitle>
          <SheetDescription>
            {gap ? (
              <>
                Para <strong>{gap.capacity_type?.name}</strong> en <strong>{gap.sector?.canonical_name}</strong>
              </>
            ) : (
              "Seleccione una brecha para ver actores"
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {actors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="w-12 h-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                No hay actores con esta capacidad registrados
              </p>
            </div>
          ) : (
            <>
              {actors.map((actor) => {
                const isInvited = invitedActors.has(actor.actorId);
                const availConfig = availabilityLabels[actor.capability.availability];

                return (
                  <div 
                    key={actor.actorId}
                    className="flex items-center justify-between p-4 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{actor.actorName}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>
                            {actor.capability.quantity} {actor.capability.unit}
                          </span>
                          <Badge variant={availConfig.variant} className="text-xs">
                            {availConfig.label}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {isAdmin && (
                      <Button
                        size="sm"
                        variant={isInvited ? "outline" : "default"}
                        disabled={isInvited || actor.capability.availability === 'unavailable'}
                        onClick={() => handleInvite(actor.actorId, actor.actorName)}
                      >
                        {isInvited ? (
                          <>
                            <Check className="w-4 h-4 mr-1" />
                            Invitado
                          </>
                        ) : (
                          "Invitar a coordinar"
                        )}
                      </Button>
                    )}
                  </div>
                );
              })}

              {/* Disclaimer */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20 text-sm">
                <AlertTriangle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
                <p className="text-muted-foreground">
                  <strong className="text-foreground">Nota:</strong> La coordinación es voluntaria. 
                  Esta acción no es vinculante y el actor debe confirmar su participación.
                </p>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

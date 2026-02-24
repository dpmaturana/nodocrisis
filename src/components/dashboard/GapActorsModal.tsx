import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import type { GapWithDetails } from "@/services/gapService";

interface DeployedActor {
  id: string;
  name: string;
  status: string;
  updatedAt: string;
  notes: string | null;
}

const STATUS_STYLE: Record<string, string> = {
  operating: "bg-coverage/20 text-coverage border-coverage/50",
  confirmed: "bg-sky-500/20 text-sky-400 border-sky-500/30",
  interested: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  suspended: "bg-destructive/20 text-destructive border-destructive/50",
  finished: "bg-muted text-muted-foreground border-muted",
};

const STATUS_LABEL: Record<string, string> = {
  operating: "Operating",
  confirmed: "Confirmed",
  interested: "Interested",
  suspended: "Suspended",
  finished: "Finished",
};

interface GapActorsModalProps {
  gap: GapWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GapActorsModal({ gap, open, onOpenChange }: GapActorsModalProps) {
  const [actors, setActors] = useState<DeployedActor[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!gap || !open) return;
    setIsLoading(true);

    (async () => {
      const { data: deps } = await supabase
        .from("deployments")
        .select("actor_id, status, updated_at, notes")
        .eq("sector_id", gap.sector_id)
        .eq("capacity_type_id", gap.capacity_type_id)
        .in("status", ["interested", "confirmed", "operating", "suspended", "finished"])
        .order("updated_at", { ascending: false });

      if (!deps || deps.length === 0) {
        setActors([]);
        setIsLoading(false);
        return;
      }

      const actorUserIds = [...new Set(deps.map((d) => d.actor_id))];
      const { data: members } = await supabase
        .from("actor_members")
        .select("user_id, actor_id")
        .in("user_id", actorUserIds);

      const actorOrgIds = [...new Set((members ?? []).map(m => m.actor_id))];
      const actorNameMap = new Map<string, string>();
      if (actorOrgIds.length > 0) {
        const { data: actors } = await supabase
          .from("actors")
          .select("id, organization_name")
          .in("id", actorOrgIds);
        (actors ?? []).forEach(a => actorNameMap.set(a.id, a.organization_name));
      }
      const nameMap = new Map<string, string>();
      (members ?? []).forEach(m => {
        const name = actorNameMap.get(m.actor_id);
        if (name) nameMap.set(m.user_id, name);
      });

      setActors(
        deps.map((d) => {
          return {
            id: d.actor_id,
            name: nameMap.get(d.actor_id) ?? "Unknown actor",
            status: d.status,
            updatedAt: d.updated_at,
            notes: d.notes,
          };
        }),
      );
      setIsLoading(false);
    })();
  }, [gap, open]);

  if (!gap) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Deployed actors: {gap.capacity_type?.name}
          </DialogTitle>
          <DialogDescription>
            {gap.sector?.canonical_name} — Organizations assigned to this need
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh]">
          <div className="space-y-2 pr-4">
            {isLoading && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Loading…
              </p>
            )}

            {!isLoading && actors.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No organizations deployed for this need
              </p>
            )}

            {!isLoading &&
              actors.map((actor, i) => (
                <div
                  key={`${actor.id}-${i}`}
                  className="flex items-center justify-between gap-3 bg-muted/30 rounded-md p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{actor.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(actor.updatedAt), { addSuffix: true })}
                    </p>
                    {actor.notes && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{actor.notes}</p>
                    )}
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] shrink-0 ${STATUS_STYLE[actor.status] ?? ""}`}
                  >
                    {STATUS_LABEL[actor.status] ?? actor.status}
                  </Badge>
                </div>
              ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { ActorCapabilityDeclared } from "@/types/database";
import { CAPABILITY_LEVEL_LABELS } from "@/types/database";

interface CapabilityDeclaredListProps {
  capabilities: ActorCapabilityDeclared[];
  capacityTypeNames: Record<string, string>;
  onRemove: (capabilityId: string) => void;
}

export function CapabilityDeclaredList({
  capabilities,
  capacityTypeNames,
  onRemove,
}: CapabilityDeclaredListProps) {
  const [pendingRemove, setPendingRemove] = useState<ActorCapabilityDeclared | null>(null);

  if (capabilities.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        No hay capacidades declaradas
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {capabilities.map((cap) => (
        <div
          key={cap.id}
          className="flex items-start justify-between p-3 bg-muted/50 rounded-lg"
        >
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">
                {capacityTypeNames[cap.capacity_type_id] || "Capacidad"}
              </span>
              <Badge variant="secondary" className="text-xs">
                {CAPABILITY_LEVEL_LABELS[cap.level]}
              </Badge>
            </div>
            {cap.notes && (
              <p className="text-xs text-muted-foreground mt-1">{cap.notes}</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => setPendingRemove(cap)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!pendingRemove} onOpenChange={(open) => !open && setPendingRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar capacidad?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>Estás a punto de eliminar la siguiente capacidad declarada:</p>
                {pendingRemove && (
                  <div className="p-3 bg-muted rounded-lg space-y-1">
                    <p className="font-medium text-sm text-foreground">
                      {capacityTypeNames[pendingRemove.capacity_type_id] || "Capacidad"}
                    </p>
                    <Badge variant="secondary" className="text-xs">
                      {CAPABILITY_LEVEL_LABELS[pendingRemove.level]}
                    </Badge>
                    {pendingRemove.notes && (
                      <p className="text-xs text-muted-foreground">{pendingRemove.notes}</p>
                    )}
                  </div>
                )}
                <p>Esta acción no se puede deshacer.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingRemove) {
                  onRemove(pendingRemove.id);
                  setPendingRemove(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
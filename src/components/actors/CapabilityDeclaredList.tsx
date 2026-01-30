import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
            onClick={() => onRemove(cap.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}
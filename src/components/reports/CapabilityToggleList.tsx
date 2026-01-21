import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { SuggestedCapability, CapacityType } from "@/types/database";
import { useState } from "react";

interface CapabilityToggleListProps {
  capabilities: SuggestedCapability[];
  allCapacityTypes: CapacityType[];
  onUpdate: (capabilities: SuggestedCapability[]) => void;
}

export function CapabilityToggleList({
  capabilities,
  allCapacityTypes,
  onUpdate,
}: CapabilityToggleListProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);

  const toggleCapability = (index: number) => {
    const updated = [...capabilities];
    updated[index] = { ...updated[index], include: !updated[index].include };
    onUpdate(updated);
  };

  const addCapability = (capabilityName: string) => {
    // Check if already exists
    if (capabilities.some((c) => c.capability_name === capabilityName)) {
      // Just enable it
      const updated = capabilities.map((c) =>
        c.capability_name === capabilityName ? { ...c, include: true } : c
      );
      onUpdate(updated);
    } else {
      onUpdate([
        ...capabilities,
        { capability_name: capabilityName, confidence: 1.0, include: true },
      ]);
    }
    setPopoverOpen(false);
  };

  // Get capabilities not yet in the list
  const availableToAdd = allCapacityTypes.filter(
    (ct) => !capabilities.some((c) => c.capability_name === ct.name)
  );

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "border-coverage/50";
    if (confidence >= 0.5) return "border-warning/50";
    return "border-muted";
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {capabilities.map((cap, index) => (
          <label
            key={cap.capability_name}
            className={cn(
              "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
              cap.include
                ? cn("bg-card border-2", getConfidenceColor(cap.confidence))
                : "bg-muted/20 border-border/50 opacity-60"
            )}
          >
            <Checkbox
              checked={cap.include}
              onCheckedChange={() => toggleCapability(index)}
              className="h-5 w-5"
            />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium truncate block">
                {cap.capability_name}
              </span>
              {cap.confidence < 1 && (
                <span className="text-xs text-muted-foreground font-mono">
                  {Math.round(cap.confidence * 100)}% conf.
                </span>
              )}
            </div>
          </label>
        ))}
      </div>

      {availableToAdd.length > 0 && (
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Agregar capacidad
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start">
            <div className="space-y-1">
              {availableToAdd.map((ct) => (
                <button
                  key={ct.id}
                  onClick={() => addCapability(ct.name)}
                  className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
                >
                  {ct.name}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

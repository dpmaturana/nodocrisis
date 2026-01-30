import { useState, useEffect } from "react";
import { Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CapacityIcon } from "@/components/ui/CapacityIcon";
import { useToast } from "@/hooks/use-toast";
import { deploymentService } from "@/services";
import type { EnrichedSector } from "@/services/sectorService";
import type { ActorCapability, SectorGap } from "@/types/database";

interface EnrollmentModalProps {
  sector: EnrichedSector | null;
  userCapabilities: ActorCapability[];
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface CapabilityOption {
  capability: ActorCapability;
  matchingGap: SectorGap | null;
  selected: boolean;
}

export function EnrollmentModal({
  sector,
  userCapabilities,
  userId,
  open,
  onOpenChange,
  onSuccess,
}: EnrollmentModalProps) {
  const { toast } = useToast();
  const [options, setOptions] = useState<CapabilityOption[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize options when sector changes
  useEffect(() => {
    if (!sector || !open) return;

    const newOptions: CapabilityOption[] = userCapabilities.map((cap) => {
      const matchingGap = sector.gaps.find(
        (g) => g.capacityType.id === cap.capacity_type_id
      );
      
      // Pre-select if there's an active gap matching this capability
      const shouldPreSelect = matchingGap && (matchingGap.isCritical || matchingGap.maxLevel === "high");
      
      return {
        capability: cap,
        matchingGap: matchingGap || null,
        selected: !!shouldPreSelect,
      };
    });

    // Sort: with matching gaps first, then by gap severity
    newOptions.sort((a, b) => {
      if (a.matchingGap && !b.matchingGap) return -1;
      if (!a.matchingGap && b.matchingGap) return 1;
      if (a.matchingGap?.isCritical && !b.matchingGap?.isCritical) return -1;
      if (!a.matchingGap?.isCritical && b.matchingGap?.isCritical) return 1;
      return 0;
    });

    setOptions(newOptions);
  }, [sector, userCapabilities, open]);

  const toggleOption = (capabilityId: string) => {
    setOptions((prev) =>
      prev.map((opt) =>
        opt.capability.id === capabilityId
          ? { ...opt, selected: !opt.selected }
          : opt
      )
    );
  };

  const selectedCount = options.filter((o) => o.selected).length;

  const handleSubmit = async () => {
    if (!sector || selectedCount === 0) return;

    setIsSubmitting(true);

    try {
      const selectedOptions = options.filter((o) => o.selected);
      
      // Create a deployment for each selected capability
      await Promise.all(
        selectedOptions.map((opt) =>
          deploymentService.enroll(
            userId,
            sector.event.id,
            sector.sector.id,
            opt.capability.capacity_type_id,
            `Enrollment from sector ${sector.sector.canonical_name}`
          )
        )
      );

      toast({
        title: "Enrollment successful",
        description: `You have enrolled in ${sector.sector.canonical_name} with ${selectedCount} ${selectedCount > 1 ? "capabilities" : "capability"}.`,
      });

      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Enrollment error",
        description: error.message || "Could not complete the enrollment",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!sector) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enroll in {sector.sector.canonical_name}</DialogTitle>
          <DialogDescription>
            Select the capabilities you can provide in this sector:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4 max-h-[400px] overflow-y-auto">
          {options.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              You have no declared capabilities. Add capabilities in your profile to enroll.
            </p>
          ) : (
            options.map((option) => {
              const cap = option.capability;
              const gap = option.matchingGap;
              
              return (
                <label
                  key={cap.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    option.selected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <Checkbox
                    checked={option.selected}
                    onCheckedChange={() => toggleOption(cap.id)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <CapacityIcon
                        name={cap.capacity_type_id}
                        icon=""
                        size="sm"
                      />
                      <span className="font-medium text-sm">
                        {/* We'll get the name from the gap if available */}
                        {gap?.capacityType.name || `Capability`}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      You have: {cap.quantity} {cap.unit}
                      {cap.availability === "limited" && " (limited)"}
                    </p>
                    {gap ? (
                      <p className={`text-xs mt-1 ${gap.isCritical ? "text-gap-critical" : "text-warning"}`}>
                        Gap: {gap.isCritical ? "🔴 Critical" : "🟠 Partial"}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-1">
                        No active gap in this sector
                      </p>
                    )}
                  </div>
                </label>
              );
            })
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={selectedCount === 0 || isSubmitting}
          >
            {isSubmitting ? (
              "Enrolling..."
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Confirm enrollment ({selectedCount})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

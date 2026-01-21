import { useEffect, useState } from "react";
import { ChevronDown, Eye } from "lucide-react";
import { gapService } from "@/services";
import { MOCK_GAPS, getSectorById, getCapacityTypeById } from "@/services/mock/data";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Gap } from "@/types/database";

interface MonitoredSectorsProps {
  eventId: string;
}

export function MonitoredSectors({ eventId }: MonitoredSectorsProps) {
  const [evaluatingGaps, setEvaluatingGaps] = useState<Gap[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Get evaluating gaps
    const gaps = MOCK_GAPS.filter(g => 
      g.event_id === eventId && 
      g.state === 'evaluating'
    );
    setEvaluatingGaps(gaps);
  }, [eventId]);

  if (evaluatingGaps.length === 0) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button 
          variant="ghost" 
          className="w-full justify-between h-auto py-3 px-4 hover:bg-muted/50"
        >
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              Sectores monitoreados
            </span>
            <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
              {evaluatingGaps.length} en evaluación
            </span>
          </div>
          <ChevronDown className={cn(
            "w-4 h-4 text-muted-foreground transition-transform",
            isOpen && "rotate-180"
          )} />
        </Button>
      </CollapsibleTrigger>
      
      <CollapsibleContent>
        <div className="px-4 pb-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {evaluatingGaps.map((gap) => {
              const sector = getSectorById(gap.sector_id);
              const capacityType = getCapacityTypeById(gap.capacity_type_id);
              
              return (
                <div 
                  key={gap.id}
                  className="flex items-center gap-2 p-2 rounded-lg border border-muted bg-muted/30 text-sm"
                >
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/50" />
                  <span className="text-muted-foreground">
                    {capacityType?.name} · {sector?.canonical_name}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Estas combinaciones sector×capacidad están siendo monitoreadas pero aún no requieren acción.
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

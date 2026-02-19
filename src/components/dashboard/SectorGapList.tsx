import { useEffect, useState } from "react";
import { gapService } from "@/services";
import type { SectorWithGaps } from "@/services/gapService";
import type { GapWithDetails } from "@/services/gapService";
import type { SeverityFilter } from "./FilterChips";
import { SectorCardAdmin } from "./SectorCardAdmin";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";

interface SectorGapListProps {
  eventId: string;
  activeFilters: SeverityFilter[];
  activeCapacityFilters?: string[];
  onViewSectorDetails: (sectorId: string) => void;
  onViewSignals: (gap: GapWithDetails) => void;
  onActivateActors: (gap: GapWithDetails) => void;
  focusedSectorId?: string | null;
  highlightedCardId?: string | null;
  onSectorHover?: (sectorId: string | null) => void;
  onSectorsLoaded?: (sectors: SectorWithGaps[]) => void;
  gridColumns?: 1 | 2;
}

export function SectorGapList({
  eventId,
  activeFilters,
  activeCapacityFilters = [],
  onViewSectorDetails,
  onViewSignals,
  onActivateActors,
  focusedSectorId,
  highlightedCardId,
  onSectorHover,
  onSectorsLoaded,
  gridColumns = 1,
}: SectorGapListProps) {
  const [sectorsWithGaps, setSectorsWithGaps] = useState<SectorWithGaps[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const data = await gapService.getGapsGroupedBySector(eventId);
        setSectorsWithGaps(data);
        onSectorsLoaded?.(data);
      } catch (error) {
        console.error("Error fetching gaps grouped by sector:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [eventId]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-48" />
        ))}
      </div>
    );
  }

  // Filter sectors and gaps based on active filters
  const filteredSectors = sectorsWithGaps
    .map((sectorData) => {
      let filteredGaps = sectorData.gaps;

      // Filter gaps by severity
      if (activeFilters.length > 0) {
        filteredGaps = filteredGaps.filter((gap) =>
          activeFilters.includes(gap.state as SeverityFilter)
        );
      }

      // Filter gaps by capacity type
      if (activeCapacityFilters.length > 0) {
        filteredGaps = filteredGaps.filter((gap) =>
          activeCapacityFilters.includes(gap.capacity_type_id)
        );
      }

      if (filteredGaps.length === 0 && (activeFilters.length > 0 || activeCapacityFilters.length > 0)) {
        return null;
      }

      // If no filters active, show all
      if (activeFilters.length === 0 && activeCapacityFilters.length === 0) {
        return sectorData;
      }

      return {
        ...sectorData,
        gaps: filteredGaps,
        gapCounts: {
          critical: filteredGaps.filter((g) => g.state === "critical").length,
          partial: filteredGaps.filter((g) => g.state === "partial").length,
        },
      };
    })
    .filter(Boolean) as SectorWithGaps[];

  if (filteredSectors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-coverage/20 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-coverage" />
        </div>
        <p className="text-lg font-medium text-coverage">
          Sin brechas que mostrar
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {activeFilters.length > 0
            ? "No hay brechas con los filtros seleccionados"
            : "Todos los sectores están siendo monitoreados"}
        </p>
      </div>
    );
  }

  const gridClass = gridColumns === 2 
    ? "grid grid-cols-1 md:grid-cols-2 gap-4" 
    : "space-y-4";

  return (
    <div className={gridClass}>
      {filteredSectors.map((sectorData) => (
        <SectorCardAdmin
          key={sectorData.sector.id}
          sector={sectorData.sector}
          context={sectorData.context}
          gaps={sectorData.gaps}
          gapSignalTypes={sectorData.gapSignalTypes}
          sectorNeedStatus={sectorData.sector_need_status}
          sectorNeedScore={sectorData.sector_need_score}
          sectorHighUncertainty={sectorData.sector_high_uncertainty}
          sectorOverrideReasons={sectorData.sector_override_reasons}
          onViewDetails={() => onViewSectorDetails(sectorData.sector.id)}
          onViewSignals={onViewSignals}
          onActivateActors={onActivateActors}
          isHighlighted={highlightedCardId === sectorData.sector.id}
          onMouseEnter={() => onSectorHover?.(sectorData.sector.id)}
          onMouseLeave={() => onSectorHover?.(null)}
        />
      ))}
    </div>
  );
}

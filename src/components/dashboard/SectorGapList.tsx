import { useEffect, useState } from "react";
import { gapService } from "@/services";
import type { SectorWithGaps } from "@/services/gapService";
import type { NeedStatus } from "@/lib/needStatus";
import { SectorStatusChip } from "./SectorStatusChip";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";

interface SectorGapListProps {
  eventId: string;
  activeSectorStatusFilters: NeedStatus[];
  activeCapacityFilters?: string[];
  onViewSectorDetails: (sectorId: string) => void;
  focusedSectorId?: string | null;
  highlightedCardId?: string | null;
  onSectorHover?: (sectorId: string | null) => void;
  onSectorsLoaded?: (sectors: SectorWithGaps[]) => void;
  gridColumns?: 1 | 2;
}

export function SectorGapList({
  eventId,
  activeSectorStatusFilters,
  activeCapacityFilters = [],
  onViewSectorDetails,
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

  // Filter sectors based on active filters
  const filteredSectors = sectorsWithGaps
    .filter((sectorData) => {
      // Filter 1: sector status
      if (activeSectorStatusFilters.length > 0) {
        const status = sectorData.sector_need_status ?? "WHITE";
        if (!activeSectorStatusFilters.includes(status)) return false;
      }
      // Filter 2: capacity
      if (activeCapacityFilters.length > 0) {
        const hasMatch = sectorData.gaps.some((g) =>
          activeCapacityFilters.includes(g.capacity_type_id)
        );
        if (!hasMatch) return false;
      }
      return true;
    });

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
          {activeSectorStatusFilters.length > 0 || activeCapacityFilters.length > 0
            ? "No hay sectores con los filtros seleccionados"
            : "Todos los sectores están siendo monitoreados"}
        </p>
      </div>
    );
  }

  const gridClass = gridColumns === 2 
    ? "grid grid-cols-1 md:grid-cols-2 gap-4 items-start" 
    : "space-y-4";

  return (
    <div className={gridClass}>
      {filteredSectors.map((sectorData) => (
        <SectorStatusChip
          key={sectorData.sector.id}
          sectorName={sectorData.sector.canonical_name}
          sectorId={sectorData.sector.id}
          sectorNeedStatus={sectorData.sector_need_status ?? "WHITE"}
          gaps={sectorData.gaps}
          onViewDetails={() => onViewSectorDetails(sectorData.sector.id)}
          isHighlighted={highlightedCardId === sectorData.sector.id}
          onMouseEnter={() => onSectorHover?.(sectorData.sector.id)}
          onMouseLeave={() => onSectorHover?.(null)}
        />
      ))}
    </div>
  );
}

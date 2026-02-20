import { MapPin, Activity, X, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { NEED_STATUS_PRESENTATION, type NeedStatus } from "@/lib/needStatus";

interface CapacityOption {
  id: string;
  name: string;
}

interface FilterChipsProps {
  counts: {
    sectorsWithGaps: number;
    byStatus: Partial<Record<NeedStatus, number>>;
    operatingActors: number;
  };
  activeSectorStatusFilters: NeedStatus[];
  onSectorStatusFilterChange: (filters: NeedStatus[]) => void;
  onOpenActorsModal: () => void;
  capacityOptions?: CapacityOption[];
  activeCapacityFilters?: string[];
  onCapacityFilterChange?: (ids: string[]) => void;
}

export function FilterChips({
  counts,
  activeSectorStatusFilters,
  onSectorStatusFilterChange,
  onOpenActorsModal,
  capacityOptions = [],
  activeCapacityFilters = [],
  onCapacityFilterChange,
}: FilterChipsProps) {
  const toggleStatus = (status: NeedStatus) => {
    if (activeSectorStatusFilters.includes(status)) {
      onSectorStatusFilterChange(activeSectorStatusFilters.filter((s) => s !== status));
    } else {
      onSectorStatusFilterChange([...activeSectorStatusFilters, status]);
    }
  };

  const toggleCapacity = (id: string) => {
    if (!onCapacityFilterChange) return;
    if (activeCapacityFilters.includes(id)) {
      onCapacityFilterChange(activeCapacityFilters.filter((c) => c !== id));
    } else {
      onCapacityFilterChange([...activeCapacityFilters, id]);
    }
  };

  const clearFilters = () => {
    onSectorStatusFilterChange([]);
    onCapacityFilterChange?.([]);
  };

  const hasActiveFilters = activeSectorStatusFilters.length > 0 || activeCapacityFilters.length > 0;

  // Status chips ordered: RED, ORANGE, YELLOW, GREEN
  const STATUS_CHIP_ORDER: NeedStatus[] = ["RED", "ORANGE", "YELLOW", "GREEN"];

  // Static hover class mappings (Tailwind requires complete class names at build time)
  const STATUS_HOVER_CLASS: Record<NeedStatus, string> = {
    RED: "hover:text-gap-critical hover:border-gap-critical",
    ORANGE: "hover:text-orange-400 hover:border-orange-400",
    YELLOW: "hover:text-warning hover:border-warning",
    GREEN: "hover:text-coverage hover:border-coverage",
    WHITE: "hover:text-muted-foreground hover:border-muted-foreground",
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Sectors with gaps - static text, NOT a button */}
      <span className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-muted-foreground">
        <MapPin className="w-4 h-4 mr-1.5" />
        {counts.sectorsWithGaps} sectores con brechas
      </span>

      {/* NeedStatus filter chips */}
      {STATUS_CHIP_ORDER.map((status) => {
        const count = counts.byStatus[status] ?? 0;
        if (count === 0) return null;
        const presentation = NEED_STATUS_PRESENTATION[status];
        const Icon = presentation.icon;
        const isActive = activeSectorStatusFilters.includes(status);
        return (
          <Badge
            key={status}
            variant="outline"
            className={cn(
              "px-3 py-1.5 text-sm font-medium cursor-pointer transition-all",
              isActive
                ? cn(presentation.bg, presentation.text, "border-current")
                : STATUS_HOVER_CLASS[status],
            )}
            onClick={() => toggleStatus(status)}
          >
            <Icon className="w-4 h-4 mr-1.5" />
            {count} {presentation.shortLabel}
          </Badge>
        );
      })}

      {/* Capacity type filter dropdown */}
      {capacityOptions.length > 0 && onCapacityFilterChange && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Badge
              variant="outline"
              className={cn(
                "px-3 py-1.5 text-sm font-medium cursor-pointer transition-all",
                activeCapacityFilters.length > 0 && "border-primary text-primary",
              )}
            >
              Capacidad
              {activeCapacityFilters.length > 0 && ` (${activeCapacityFilters.length})`}
              <ChevronDown className="w-3 h-3 ml-1" />
            </Badge>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="bg-popover">
            {capacityOptions.map((cap) => (
              <DropdownMenuCheckboxItem
                key={cap.id}
                checked={activeCapacityFilters.includes(cap.id)}
                onCheckedChange={() => toggleCapacity(cap.id)}
              >
                {cap.name}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Clear filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4 mr-1" />
          Limpiar
        </Button>
      )}

      {/* Spacer */}
      <div className="ml-auto" />

      {/* Operating actors - outline button, visually distinct from filters */}
      <Button
        variant="outline"
        size="sm"
        onClick={onOpenActorsModal}
        className="text-muted-foreground"
      >
        <Activity className="w-4 h-4 mr-1.5" />
        {counts.operatingActors} organizaciones operando
      </Button>
    </div>
  );
}

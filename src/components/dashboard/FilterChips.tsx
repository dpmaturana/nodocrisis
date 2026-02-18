import { MapPin, AlertCircle, AlertTriangle, Activity, X, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type SeverityFilter = "critical" | "partial";

interface FilterCounts {
  sectorsWithGaps: number;
  critical: number;
  partial: number;
  operatingActors: number;
}

interface CapacityOption {
  id: string;
  name: string;
}

interface FilterChipsProps {
  counts: FilterCounts;
  activeFilters: SeverityFilter[];
  onFilterChange: (filters: SeverityFilter[]) => void;
  onOpenActorsModal: () => void;
  capacityOptions?: CapacityOption[];
  activeCapacityFilters?: string[];
  onCapacityFilterChange?: (ids: string[]) => void;
}

export function FilterChips({
  counts,
  activeFilters,
  onFilterChange,
  onOpenActorsModal,
  capacityOptions = [],
  activeCapacityFilters = [],
  onCapacityFilterChange,
}: FilterChipsProps) {
  const toggleFilter = (filter: SeverityFilter) => {
    if (activeFilters.includes(filter)) {
      onFilterChange(activeFilters.filter((f) => f !== filter));
    } else {
      onFilterChange([...activeFilters, filter]);
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
    onFilterChange([]);
    onCapacityFilterChange?.([]);
  };

  const hasActiveFilters = activeFilters.length > 0 || activeCapacityFilters.length > 0;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Sectors with gaps - static text, NOT a button */}
      <span className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-muted-foreground">
        <MapPin className="w-4 h-4 mr-1.5" />
        {counts.sectorsWithGaps} sectores con brechas
      </span>

      {/* Critical filter */}
      <Badge
        variant="outline"
        className={cn(
          "px-3 py-1.5 text-sm font-medium cursor-pointer transition-all",
          activeFilters.includes("critical")
            ? "bg-gap-critical text-white border-gap-critical"
            : "hover:border-gap-critical hover:text-gap-critical",
        )}
        onClick={() => toggleFilter("critical")}
      >
        <AlertCircle className="w-4 h-4 mr-1.5" />
        {counts.critical} rojo
      </Badge>

      {/* Partial filter */}
      <Badge
        variant="outline"
        className={cn(
          "px-3 py-1.5 text-sm font-medium cursor-pointer transition-all",
          activeFilters.includes("partial")
            ? "bg-warning text-warning-foreground border-warning"
            : "hover:border-warning hover:text-warning",
        )}
        onClick={() => toggleFilter("partial")}
      >
        <AlertTriangle className="w-4 h-4 mr-1.5" />
        {counts.partial} naranja
      </Badge>

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

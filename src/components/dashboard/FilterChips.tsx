import { useState } from "react";
import { MapPin, AlertCircle, AlertTriangle, Activity, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SeverityFilter = "critical" | "partial";

interface FilterCounts {
  sectorsWithGaps: number;
  critical: number;
  partial: number;
  operatingActors: number;
}

interface FilterChipsProps {
  counts: FilterCounts;
  activeFilters: SeverityFilter[];
  onFilterChange: (filters: SeverityFilter[]) => void;
  onOpenActorsModal: () => void;
}

export function FilterChips({ counts, activeFilters, onFilterChange, onOpenActorsModal }: FilterChipsProps) {
  const toggleFilter = (filter: SeverityFilter) => {
    if (activeFilters.includes(filter)) {
      onFilterChange(activeFilters.filter((f) => f !== filter));
    } else {
      onFilterChange([...activeFilters, filter]);
    }
  };

  const clearFilters = () => {
    onFilterChange([]);
  };

  const hasActiveFilters = activeFilters.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Sectors with gaps - info chip, not a filter */}
      <Badge variant="outline" className="px-3 py-1.5 text-sm font-medium bg-muted/50">
        <MapPin className="w-4 h-4 mr-1.5" />
        {counts.sectorsWithGaps} sectors with gaps
      </Badge>

      {/* Critical gaps filter */}
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
        {counts.critical} critical
      </Badge>

      {/* Partial gaps filter */}
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
        {counts.partial} parcial
      </Badge>

      {/* Operating actors - opens modal */}
      <Badge
        variant="outline"
        className="px-3 py-1.5 text-sm font-medium cursor-pointer transition-all hover:border-coverage hover:text-coverage"
        onClick={onOpenActorsModal}
      >
        <Activity className="w-4 h-4 mr-1.5" />
        {counts.operatingActors} organizations operating
      </Badge>

      {/* Clear filters button */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4 mr-1" />
          Clear filters
        </Button>
      )}
    </div>
  );
}

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CHILE_REGIONS, ACTOR_TYPE_LABELS, type ActorType } from "@/types/database";
import type { CapacityType } from "@/types/database";

interface ActorListFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  capacityFilter: string | null;
  onCapacityChange: (value: string | null) => void;
  regionFilter: string | null;
  onRegionChange: (value: string | null) => void;
  typeFilter: ActorType | null;
  onTypeChange: (value: ActorType | null) => void;
  capacityTypes?: CapacityType[];
}

export function ActorListFilters({
  searchQuery,
  onSearchChange,
  capacityFilter,
  onCapacityChange,
  regionFilter,
  onRegionChange,
  typeFilter,
  onTypeChange,
  capacityTypes = [],
}: ActorListFiltersProps) {
  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre de organización..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {/* Capacity Filter */}
        <Select
          value={capacityFilter || "all"}
          onValueChange={(v) => onCapacityChange(v === "all" ? null : v)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Capacidad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las capacidades</SelectItem>
            {capacityTypes.map((cap) => (
              <SelectItem key={cap.id} value={cap.id}>
                {cap.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Region Filter */}
        <Select
          value={regionFilter || "all"}
          onValueChange={(v) => onRegionChange(v === "all" ? null : v)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Zona" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las zonas</SelectItem>
            {CHILE_REGIONS.map((region) => (
              <SelectItem key={region} value={region}>
                {region}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Type Filter */}
        <Select
          value={typeFilter || "all"}
          onValueChange={(v) => onTypeChange(v === "all" ? null : v as ActorType)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tipo de actor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {(Object.entries(ACTOR_TYPE_LABELS) as [ActorType, string][]).map(
              ([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
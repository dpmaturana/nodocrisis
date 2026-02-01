import { ChevronRight, AlertCircle, AlertTriangle, Eye, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Sector, SignalType } from "@/types/database";
import type { GapWithDetails } from "@/services/gapService";
import type { SectorContext } from "@/services/mock/data";

interface SectorCardAdminProps {
  sector: Sector;
  context: SectorContext;
  gaps: GapWithDetails[];
  gapSignalTypes: Record<string, SignalType[]>;
  onViewDetails: () => void;
  onViewSignals: (gap: GapWithDetails) => void;
  onActivateActors: (gap: GapWithDetails) => void;
  isHighlighted?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export function SectorCardAdmin({
  sector,
  context,
  gaps,
  gapSignalTypes,
  onViewDetails,
  onViewSignals,
  onActivateActors,
  isHighlighted,
  onMouseEnter,
  onMouseLeave,
}: SectorCardAdminProps) {
  const criticalCount = gaps.filter((g) => g.state === "critical").length;
  const partialCount = gaps.filter((g) => g.state === "partial").length;
  const hasCritical = criticalCount > 0;

  // Sort gaps: critical first, then partial - show max 2
  const sortedGaps = [...gaps].sort((a, b) => {
    if (a.state === "critical" && b.state !== "critical") return -1;
    if (a.state !== "critical" && b.state === "critical") return 1;
    return 0;
  });
  const visibleGaps = sortedGaps.slice(0, 2);
  const hiddenGapsCount = gaps.length - visibleGaps.length;

  return (
    <Card
      id={`sector-${sector.id}`}
      className={cn(
        "border-l-4 transition-all duration-300",
        hasCritical ? "border-l-gap-critical" : "border-l-warning",
        isHighlighted && "ring-2 ring-primary ring-offset-2 ring-offset-background"
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <CardContent className="p-3">
        {/* Header row: Name + status badges + details CTA */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="font-semibold text-sm truncate">{sector.canonical_name}</h3>
            {/* Inline status badges */}
            <div className="flex items-center gap-1.5 shrink-0">
              {criticalCount > 0 && (
                <span className="flex items-center gap-0.5 text-gap-critical">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">{criticalCount}</span>
                </span>
              )}
              {partialCount > 0 && (
                <span className="flex items-center gap-0.5 text-warning">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">{partialCount}</span>
                </span>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onViewDetails}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0"
          >
            Ver detalles
            <ChevronRight className="w-3 h-3 ml-0.5" />
          </Button>
        </div>

        {/* Context bullets (max 2, truncated) */}
        {context.keyPoints.length > 0 && (
          <ul className="mb-2 space-y-0.5">
            {context.keyPoints.slice(0, 2).map((point, i) => (
              <li
                key={i}
                className="text-xs text-muted-foreground flex items-start gap-1.5 leading-tight"
              >
                <span className="text-muted-foreground/50 mt-0.5">•</span>
                <span className="line-clamp-1">{point}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Gap rows - compact inline format */}
        {visibleGaps.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Faltantes:</p>
            {visibleGaps.map((gap) => {
              const isCritical = gap.state === "critical";
              const Icon = isCritical ? AlertCircle : AlertTriangle;
              return (
                <div
                  key={gap.id}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Icon className={cn("w-3 h-3 shrink-0", isCritical ? "text-gap-critical" : "text-warning")} />
                    <span className={cn("truncate", isCritical ? "text-gap-critical" : "text-warning")}>
                      {gap.capacity_type?.name || "Capacity"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => onViewSignals(gap)}
                        >
                          <Eye className="w-3 h-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Ver señales</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => onActivateActors(gap)}
                        >
                          <Users className="w-3 h-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Activar organizaciones</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              );
            })}
            {hiddenGapsCount > 0 && (
              <p className="text-xs text-muted-foreground pl-4">
                +{hiddenGapsCount} más
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { useState } from "react";
import { ChevronRight, Eye, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Sector, SignalType } from "@/types/database";
import type { GapWithDetails } from "@/services/gapService";
import type { SectorContext } from "@/services/mock/data";
import { NEED_STATUS_ORDER, NEED_STATUS_PRESENTATION, mapGapStateToNeedStatus, type NeedStatus } from "@/lib/needStatus";

const BORDER_L_MAP: Record<NeedStatus, string> = {
  RED:    "border-l-gap-critical",
  ORANGE: "border-l-orange-500",
  YELLOW: "border-l-warning",
  GREEN:  "border-l-coverage",
  WHITE:  "border-l-muted",
};

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
  const sortedByNeed = [...gaps].sort((a, b) => {
    const aNeed = a.need_status ?? mapGapStateToNeedStatus(a.state);
    const bNeed = b.need_status ?? mapGapStateToNeedStatus(b.state);
    return NEED_STATUS_ORDER.indexOf(aNeed) - NEED_STATUS_ORDER.indexOf(bNeed);
  });

  const worstNeed: NeedStatus = sortedByNeed.length > 0
    ? (sortedByNeed[0].need_status ?? mapGapStateToNeedStatus(sortedByNeed[0].state))
    : "WHITE";

  const [showAll, setShowAll] = useState(false);
  const visibleGaps = showAll ? sortedByNeed : sortedByNeed.slice(0, 2);
  const hiddenGapsCount = sortedByNeed.length - 2;

  return (
    <Card
      id={`sector-${sector.id}`}
      className={cn(
        "border-l-4 transition-all duration-300",
        BORDER_L_MAP[worstNeed],
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
            {/* Sector meta (without derived severity) */}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium shrink-0 bg-muted/40 text-muted-foreground">
              {gaps.length} capacidad{gaps.length === 1 ? "" : "es"}
            </span>
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
              const gapNeed = gap.need_status ?? mapGapStateToNeedStatus(gap.state);
              const config = NEED_STATUS_PRESENTATION[gapNeed];
              const Icon = config.icon;
              return (
                <div
                  key={gap.id}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Icon className={cn("w-3 h-3 shrink-0", config.text)} />
                    <span className={cn("truncate", config.text)}>
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
            {!showAll && hiddenGapsCount > 0 && (
              <button
                className="text-xs text-muted-foreground pl-4 hover:text-foreground"
                onClick={() => setShowAll(true)}
              >
                +{hiddenGapsCount} más
              </button>
            )}
            {showAll && (
              <button
                className="text-xs text-muted-foreground pl-4 hover:text-foreground"
                onClick={() => setShowAll(false)}
              >
                Ver menos
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

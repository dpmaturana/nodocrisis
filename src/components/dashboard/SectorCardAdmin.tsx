import { ChevronRight, Eye, Users, ScrollText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Sector, SignalType } from "@/types/database";
import type { GapWithDetails } from "@/services/gapService";
import type { SectorContext } from "@/services/deploymentService";
import { NEED_STATUS_ORDER, NEED_STATUS_PRESENTATION, mapGapStateToNeedStatus, type NeedStatus } from "@/lib/needStatus";

interface SectorCardAdminProps {
  sector: Sector;
  context: SectorContext;
  gaps: GapWithDetails[];
  gapSignalTypes: Record<string, SignalType[]>;
  sectorNeedStatus?: NeedStatus;
  sectorNeedScore?: number;
  sectorHighUncertainty?: boolean;
  sectorOverrideReasons?: string[];
  onViewDetails: () => void;
  onViewSignals: (gap: GapWithDetails) => void;
  onActivateActors: (gap: GapWithDetails) => void;
  onViewActivityLog?: (gap: GapWithDetails) => void;
  onViewGapActors?: (gap: GapWithDetails) => void;
  isHighlighted?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export function SectorCardAdmin({
  sector,
  context,
  gaps,
  gapSignalTypes: _gapSignalTypes,
  sectorNeedStatus,
  sectorNeedScore,
  sectorHighUncertainty,
  sectorOverrideReasons,
  onViewDetails,
  onViewSignals,
  onActivateActors,
  onViewActivityLog,
  onViewGapActors,
  isHighlighted,
  onMouseEnter,
  onMouseLeave,
}: SectorCardAdminProps) {
  const sortedByNeed = [...gaps].sort((a, b) => {
    const aNeed = a.need_status ?? mapGapStateToNeedStatus(a.state);
    const bNeed = b.need_status ?? mapGapStateToNeedStatus(b.state);
    return NEED_STATUS_ORDER.indexOf(aNeed) - NEED_STATUS_ORDER.indexOf(bNeed);
  });

  const sectorStatus = NEED_STATUS_PRESENTATION[sectorNeedStatus ?? "WHITE"];

  const visibleGaps = sortedByNeed.slice(0, 2);
  const hiddenGapsCount = gaps.length - visibleGaps.length;

  return (
    <Card
      id={`sector-${sector.id}`}
      className={cn(
        "border-l-4 transition-all duration-300",
        sectorStatus.border,
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
            <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium shrink-0", sectorStatus.bg, sectorStatus.text)}>
              {sectorStatus.shortLabel}
              {typeof sectorNeedScore === "number" && <span>· {sectorNeedScore.toFixed(2)}</span>}
              {sectorHighUncertainty && <span>· ±</span>}
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

        {(sectorHighUncertainty || (sectorOverrideReasons?.length ?? 0) > 0) && (
          <p className="text-[11px] text-muted-foreground mb-2">
            {sectorHighUncertainty ? "Alta incertidumbre" : ""}
            {sectorHighUncertainty && (sectorOverrideReasons?.length ?? 0) > 0 ? " · " : ""}
            {(sectorOverrideReasons?.length ?? 0) > 0 ? "Con reglas de sobre-escritura" : ""}
          </p>
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
                      <TooltipContent>View signals</TooltipContent>
                    </Tooltip>
                    {onViewActivityLog && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => onViewActivityLog(gap)}
                          >
                            <ScrollText className="w-3 h-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Activity log</TooltipContent>
                      </Tooltip>
                    )}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1.5 text-xs gap-1"
                          onClick={() => onViewGapActors?.(gap)}
                        >
                          <Users className="w-3 h-3" />
                          <span>{gap.actor_count ?? 0}</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>View deployed actors</TooltipContent>
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

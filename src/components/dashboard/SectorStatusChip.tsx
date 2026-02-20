import { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NEED_STATUS_ORDER, NEED_STATUS_PRESENTATION, type NeedStatus } from "@/lib/needStatus";
import type { GapWithDetails } from "@/services/gapService";
import { ActivityLogModal } from "./ActivityLogModal";

const TREND_CONFIG = {
  improving: { label: "↗ Mejorando", className: "text-coverage bg-coverage/10 border-coverage/30" },
  worsening: { label: "↘ Empeorando", className: "text-gap-critical bg-gap-critical/10 border-gap-critical/30" },
  stable:    { label: "→ Estable",    className: "text-muted-foreground bg-muted/40 border-muted" },
} as const;

interface DriverRowProps {
  gap: GapWithDetails;
  onOpenLog: (gap: GapWithDetails) => void;
}

function DriverRow({ gap, onOpenLog }: DriverRowProps) {
  const [expanded, setExpanded] = useState(false);
  const needStatus = gap.need_status ?? "WHITE";
  const config = NEED_STATUS_PRESENTATION[needStatus];
  const Icon = config.icon;
  const driverText = gap.reasoning_summary ?? undefined;
  const hasReasoning = !!driverText;
  const requirements = gap.operational_requirements ?? [];

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-sm">
        <button
          className={cn("p-0.5 rounded shrink-0", hasReasoning ? "cursor-pointer" : "cursor-default opacity-20")}
          onClick={hasReasoning ? () => setExpanded((v) => !v) : undefined}
          aria-label={expanded ? "Colapsar" : "Expandir"}
        >
          {expanded
            ? <ChevronDown className="w-3 h-3 text-muted-foreground" />
            : <ChevronRight className="w-3 h-3 text-muted-foreground" />
          }
        </button>
        <Icon className={cn("w-3 h-3 shrink-0", config.text)} />
        <button
          className={cn("truncate font-medium hover:underline cursor-pointer text-sm", config.text)}
          onClick={() => onOpenLog(gap)}
        >
          {gap.capacity_type?.name ?? "Capacidad"}
        </button>
        {gap.trend && (
          <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border font-medium shrink-0", TREND_CONFIG[gap.trend].className)}>
            {TREND_CONFIG[gap.trend].label}
          </span>
        )}
        {typeof gap.actor_count === "number" && gap.actor_count > 0 && (
          <span className="ml-auto flex items-center gap-0.5 text-muted-foreground shrink-0 text-sm">
            <Users className="w-3 h-3" />
            {gap.actor_count}
          </span>
        )}
      </div>
      {requirements.length > 0 && (
        <div className="flex flex-wrap gap-1 pl-6">
          {requirements.map((req, i) => (
            <span
              key={i}
              className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs bg-muted text-muted-foreground"
            >
              {req}
            </span>
          ))}
        </div>
      )}
      {expanded && hasReasoning && (
        <p className="pl-6 text-xs text-muted-foreground italic leading-snug line-clamp-3">
          "{driverText}"
        </p>
      )}
    </div>
  );
}

interface SectorStatusChipProps {
  sectorName: string;
  sectorId: string;
  sectorNeedStatus: NeedStatus;
  gaps: GapWithDetails[];
  onViewDetails: () => void;
  isHighlighted?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export function SectorStatusChip({
  sectorName,
  sectorId,
  sectorNeedStatus,
  gaps,
  onViewDetails,
  isHighlighted,
  onMouseEnter,
  onMouseLeave,
}: SectorStatusChipProps) {
  const [activityLogGap, setActivityLogGap] = useState<GapWithDetails | null>(null);
  const [showActivityLog, setShowActivityLog] = useState(false);

  const sectorStatus = NEED_STATUS_PRESENTATION[sectorNeedStatus];

  // Sort gaps by need status severity
  const sortedGaps = [...gaps].sort(
    (a, b) =>
      NEED_STATUS_ORDER.indexOf(a.need_status ?? "WHITE") -
      NEED_STATUS_ORDER.indexOf(b.need_status ?? "WHITE"),
  );

  const handleOpenLog = (gap: GapWithDetails) => {
    setActivityLogGap(gap);
    setShowActivityLog(true);
  };

  return (
    <>
      <Card
        id={`sector-${sectorId}`}
        className={cn(
          "border-l-4 transition-all duration-300",
          sectorStatus.border,
          isHighlighted && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        )}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <CardContent className="p-3 space-y-2">
          {/* Header */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("shrink-0", sectorStatus.text)}>
              {<sectorStatus.icon className="w-4 h-4 inline" />}
            </span>
            <h3 className="font-semibold text-base truncate flex-1">{sectorName}</h3>
            <span
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm font-medium shrink-0",
                sectorStatus.bg,
                sectorStatus.text,
              )}
            >
              {sectorStatus.shortLabel}
            </span>
          </div>

          {/* Needs */}
          {sortedGaps.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Necesidades
              </p>
              {sortedGaps.map((gap) => (
                <DriverRow
                  key={gap.id}
                  gap={gap}
                  onOpenLog={handleOpenLog}
                />
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end pt-1 border-t border-border/40">
            <Button
              variant="ghost"
              size="sm"
              onClick={onViewDetails}
              className="h-6 px-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Ver detalles →
            </Button>
          </div>
        </CardContent>
      </Card>

      <ActivityLogModal
        gap={activityLogGap}
        open={showActivityLog}
        onOpenChange={setShowActivityLog}
      />
    </>
  );
}

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  Radio,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NEED_STATUS_ORDER, NEED_STATUS_PRESENTATION, type NeedStatus } from "@/lib/needStatus";
import type { GapWithDetails } from "@/services/gapService";
import type { Signal } from "@/types/database";
import { supabase } from "@/integrations/supabase/client";
import { ActivityLogModal } from "./ActivityLogModal";

interface DriverRowProps {
  gap: GapWithDetails;
  onOpenLog: (gap: GapWithDetails) => void;
}

function DriverRow({ gap, onOpenLog }: DriverRowProps) {
  const needStatus = gap.need_status ?? "WHITE";
  const config = NEED_STATUS_PRESENTATION[needStatus];
  const Icon = config.icon;
  const requirements = gap.operational_requirements ?? [];

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs">
        <Icon className={cn("w-3 h-3 shrink-0", config.text)} />
        <button
          className={cn("truncate font-medium hover:underline cursor-pointer", config.text)}
          onClick={() => onOpenLog(gap)}
        >
          {gap.capacity_type?.name ?? "Capacidad"}
        </button>
        {typeof gap.actor_count === "number" && gap.actor_count > 0 && (
          <span className="ml-auto flex items-center gap-0.5 text-muted-foreground shrink-0">
            <Users className="w-3 h-3" />
            {gap.actor_count}
          </span>
        )}
      </div>
      {gap.reasoning_summary && (
        <p className="text-[10px] text-muted-foreground italic ml-4 leading-tight">
          {gap.reasoning_summary}
        </p>
      )}
      {requirements.length > 0 && (
        <div className="flex flex-wrap gap-1 px-2 pb-1.5 ml-4">
          {requirements.map((req, i) => (
            <span
              key={i}
              className="text-[10px] px-1.5 py-0.5 rounded-full border font-medium text-muted-foreground"
            >
              {req}
            </span>
          ))}
        </div>
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
  const [recentSignals, setRecentSignals] = useState<Signal[]>([]);
  const [activityLogGap, setActivityLogGap] = useState<GapWithDetails | null>(null);
  const [showActivityLog, setShowActivityLog] = useState(false);

  useEffect(() => {
    supabase
      .from("signals")
      .select("*")
      .eq("sector_id", sectorId)
      .order("created_at", { ascending: false })
      .limit(3)
      .then(({ data, error }) => {
        if (error) console.error("SectorStatusChip signals fetch:", error);
        setRecentSignals((data ?? []) as Signal[]);
      });
  }, [sectorId]);

  const sectorStatus = NEED_STATUS_PRESENTATION[sectorNeedStatus];

  // Sort gaps by need status severity
  const sortedGaps = [...gaps].sort(
    (a, b) =>
      NEED_STATUS_ORDER.indexOf(a.need_status ?? "WHITE") -
      NEED_STATUS_ORDER.indexOf(b.need_status ?? "WHITE"),
  );

  // Last updated from most recent signal
  const lastSignal = recentSignals[0];
  const lastUpdated = lastSignal
    ? formatDistanceToNow(new Date(lastSignal.created_at), { addSuffix: true, locale: es })
    : null;

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
            <h3 className="font-semibold text-sm truncate flex-1">{sectorName}</h3>
            <span
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium shrink-0",
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
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
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

          {/* Recent Signals */}
          {recentSignals.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Señales recientes
              </p>
              {recentSignals.map((signal) => {
                const timeAgo = formatDistanceToNow(new Date(signal.created_at), {
                  addSuffix: true,
                  locale: es,
                });
                return (
                  <div key={signal.id} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <Radio className="w-3 h-3 shrink-0 mt-0.5" />
                    <span className="truncate flex-1">{signal.source}: {signal.content}</span>
                    <span className="shrink-0 text-[10px]">{timeAgo}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-1 border-t border-border/40">
            <span className="text-[10px] text-muted-foreground">
              {lastUpdated ? `Última actualización: ${lastUpdated}` : "Sin actividad reciente"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onViewDetails}
              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
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

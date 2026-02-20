import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  AtSign,
  Building2,
  HeartHandshake,
  FileText,
  Radio,
  ChevronRight,
  ChevronDown,
  Users,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NEED_STATUS_ORDER, NEED_STATUS_PRESENTATION, type NeedStatus } from "@/lib/needStatus";
import type { GapWithDetails } from "@/services/gapService";
import type { CapabilityActivityLogEntry, ActivitySourceType } from "@/types/activityLog";
import { activityLogService } from "@/services/activityLogService";
import { ActivityLogModal } from "./ActivityLogModal";

const SOURCE_ICON: Record<ActivitySourceType, typeof AtSign> = {
  twitter: AtSign,
  institutional: Building2,
  ngo: HeartHandshake,
  original_context: FileText,
  system: Radio,
};

const statusRank: Record<NeedStatus, number> = {
  WHITE: 0,
  GREEN: 1,
  YELLOW: 2,
  ORANGE: 3,
  RED: 4,
};

function deriveTrend(logEntries: CapabilityActivityLogEntry[]): "improving" | "worsening" | "stable" {
  const statusChanges = logEntries
    .filter((e) => e.event_type === "STATUS_CHANGE")
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 2);

  if (statusChanges.length < 2) return "stable";

  const parseStatus = (entry: CapabilityActivityLogEntry): NeedStatus | null => {
    const match = /\ba\s+(WHITE|GREEN|YELLOW|ORANGE|RED)\b/i.exec(entry.summary);
    return match ? (match[1].toUpperCase() as NeedStatus) : null;
  };

  const latest = parseStatus(statusChanges[0]);
  const previous = parseStatus(statusChanges[1]);

  if (!latest || !previous) return "stable";

  const diff = statusRank[latest] - statusRank[previous];
  if (diff < 0) return "improving";
  if (diff > 0) return "worsening";
  return "stable";
}

const TREND_LABEL: Record<"improving" | "worsening" | "stable", string> = {
  improving: "↑ Mejorando",
  worsening: "↓ Empeorando",
  stable: "→ Estable",
};

const TREND_CLASS: Record<"improving" | "worsening" | "stable", string> = {
  improving: "text-coverage",
  worsening: "text-gap-critical",
  stable: "text-muted-foreground",
};

interface DriverRowProps {
  gap: GapWithDetails;
  driverText?: string;
  onOpenLog: (gap: GapWithDetails) => void;
}

function DriverRow({ gap, driverText, onOpenLog }: DriverRowProps) {
  const [expanded, setExpanded] = useState(false);
  const needStatus = gap.need_status ?? "WHITE";
  const config = NEED_STATUS_PRESENTATION[needStatus];
  const Icon = config.icon;
  const requirements = gap.operational_requirements ?? [];

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs">
        <button
          onClick={() => driverText && setExpanded(v => !v)}
          className={cn(
            "shrink-0 transition-opacity",
            driverText ? "opacity-50 hover:opacity-100 cursor-pointer" : "opacity-0 pointer-events-none"
          )}
          aria-label={expanded ? "Colapsar" : "Expandir"}
        >
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
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
      {requirements.length > 0 && (
        <div className="flex flex-wrap gap-1 px-2 pb-1.5 ml-6">
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
      {expanded && driverText && (
        <div className="flex items-start gap-1.5 px-3 pb-2 pt-1 border-t border-border/40 text-[11px] text-muted-foreground">
          <Sparkles className="w-3 h-3 mt-0.5 shrink-0 text-primary/60" />
          <p>{driverText}</p>
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
  logEntries: CapabilityActivityLogEntry[];
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
  logEntries: initialLogEntries,
  onViewDetails,
  isHighlighted,
  onMouseEnter,
  onMouseLeave,
}: SectorStatusChipProps) {
  const [logEntries, setLogEntries] = useState<CapabilityActivityLogEntry[]>(initialLogEntries);
  const [activityLogGap, setActivityLogGap] = useState<GapWithDetails | null>(null);
  const [showActivityLog, setShowActivityLog] = useState(false);

  useEffect(() => {
    activityLogService.getLogForSector(sectorId).then(setLogEntries);
  }, [sectorId]);

  const sectorStatus = NEED_STATUS_PRESENTATION[sectorNeedStatus];
  const trend = deriveTrend(logEntries);

  // Sort gaps by need status severity
  const sortedGaps = [...gaps].sort(
    (a, b) =>
      NEED_STATUS_ORDER.indexOf(a.need_status ?? "WHITE") -
      NEED_STATUS_ORDER.indexOf(b.need_status ?? "WHITE"),
  );

  // Build driver text map: capability_id → most recent STATUS_CHANGE reasoning
  const driverMap = new Map<string, string>();
  const statusChanges = logEntries.filter((e) => e.event_type === "STATUS_CHANGE");
  for (const entry of statusChanges) {
    if (!driverMap.has(entry.capability_id)) {
      driverMap.set(entry.capability_id, entry.reasoning_summary ?? entry.summary);
    }
  }

  // Recent signals (last 3 SIGNAL_RECEIVED entries)
  const recentSignals = logEntries
    .filter((e) => e.event_type === "SIGNAL_RECEIVED")
    .slice(0, 3);

  // Last updated
  const lastEntry = logEntries[0];
  const lastUpdated = lastEntry
    ? formatDistanceToNow(new Date(lastEntry.timestamp), { addSuffix: true, locale: es })
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
            <span className={cn("text-xs shrink-0", TREND_CLASS[trend])}>
              {TREND_LABEL[trend]}
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
                  driverText={driverMap.get(gap.capacity_type_id)}
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
              {recentSignals.map((entry) => {
                const Icon = SOURCE_ICON[entry.source_type];
                const timeAgo = formatDistanceToNow(new Date(entry.timestamp), {
                  addSuffix: true,
                  locale: es,
                });
                return (
                  <div key={entry.id} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <Icon className="w-3 h-3 shrink-0 mt-0.5" />
                    <span className="truncate flex-1">{entry.source_name}: {entry.summary}</span>
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

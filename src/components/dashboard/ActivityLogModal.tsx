import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  AtSign,
  Building2,
  HeartHandshake,
  FileText,
  ArrowRightLeft,
  Radio,
  ShieldCheck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { activityLogService } from "@/services/activityLogService";
import type { CapabilityActivityLogEntry, ActivitySourceType, ActivityEventType } from "@/types/activityLog";
import { SOURCE_TYPE_LABELS, formatLogEntry } from "@/types/activityLog";
import type { GapWithDetails } from "@/services/gapService";

const SOURCE_ICON: Record<ActivitySourceType, typeof AtSign> = {
  twitter: AtSign,
  institutional: Building2,
  ngo: HeartHandshake,
  original_context: FileText,
};

const SOURCE_BADGE_STYLE: Record<ActivitySourceType, string> = {
  twitter: "bg-sky-500/20 text-sky-400 border-sky-500/30",
  institutional: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  ngo: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  original_context: "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

const EVENT_TYPE_ICON: Record<ActivityEventType, typeof Radio> = {
  SIGNAL_RECEIVED: Radio,
  COVERAGE_ACTIVITY_EVENT: ShieldCheck,
  STATUS_CHANGE: ArrowRightLeft,
};

const EVENT_TYPE_LABEL: Record<ActivityEventType, string> = {
  SIGNAL_RECEIVED: "Señal recibida",
  COVERAGE_ACTIVITY_EVENT: "Actividad de cobertura",
  STATUS_CHANGE: "Cambio de estado",
};

interface ActivityLogModalProps {
  gap: GapWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ActivityLogModal({ gap, open, onOpenChange }: ActivityLogModalProps) {
  const [entries, setEntries] = useState<CapabilityActivityLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!gap || !open) return;
    setIsLoading(true);
    activityLogService
      .getLogForNeed(gap.sector_id, gap.capacity_type_id)
      .then(setEntries)
      .finally(() => setIsLoading(false));
  }, [gap, open]);

  if (!gap) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Registro de actividad: {gap.capacity_type?.name}
          </DialogTitle>
          <DialogDescription>
            {gap.sector?.canonical_name} — Historial de señales y decisiones
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-3 pr-4">
            {isLoading && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Cargando registros…
              </p>
            )}

            {!isLoading && entries.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No hay registros de actividad para esta necesidad
              </p>
            )}

            {!isLoading &&
              entries.map((entry) => (
                <ActivityLogItem key={entry.id} entry={entry} />
              ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function ActivityLogItem({ entry }: { entry: CapabilityActivityLogEntry }) {
  const SourceIcon = SOURCE_ICON[entry.source_type];
  const EventIcon = EVENT_TYPE_ICON[entry.event_type];
  const sourceLabel = SOURCE_TYPE_LABELS[entry.source_type];
  const badgeStyle = SOURCE_BADGE_STYLE[entry.source_type];

  const timeAgo = formatDistanceToNow(new Date(entry.timestamp), {
    addSuffix: true,
    locale: es,
  });

  return (
    <div className="bg-muted/30 rounded-md p-3 space-y-2">
      {/* Header: event type + source badge */}
      <div className="flex items-center gap-2 flex-wrap">
        <EventIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs text-muted-foreground">
          {EVENT_TYPE_LABEL[entry.event_type]}
        </span>
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${badgeStyle}`}>
          <SourceIcon className="w-3 h-3 mr-1" />
          {sourceLabel}
        </Badge>
      </div>

      {/* Formatted summary */}
      <p className="text-sm text-foreground">
        <span className="font-medium">{entry.source_name}:</span>{" "}
        {entry.summary}
      </p>

      {/* Footer: timestamp */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <time dateTime={entry.timestamp}>{timeAgo}</time>
        {entry.metadata?.batch_processed_at && (
          <>
            <span>·</span>
            <span>Procesado en lote</span>
          </>
        )}
      </div>
    </div>
  );
}

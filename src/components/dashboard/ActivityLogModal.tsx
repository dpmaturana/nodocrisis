import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  AtSign,
  Building2,
  HeartHandshake,
  FileText,
  ArrowRightLeft,
  ArrowRight,
  Radio,
  ShieldCheck,
  Sparkles,
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
import { SOURCE_TYPE_LABELS } from "@/types/activityLog";
import { NEED_STATUS_PRESENTATION, type NeedStatus } from "@/lib/needStatus";
import type { GapWithDetails } from "@/services/gapService";

// ─── Constants ───────────────────────────────────────────────────

const SOURCE_ICON: Record<ActivitySourceType, typeof AtSign> = {
  twitter: AtSign,
  institutional: Building2,
  ngo: HeartHandshake,
  original_context: FileText,
  system: Radio,
};

const SOURCE_BADGE_STYLE: Record<ActivitySourceType, string> = {
  twitter: "bg-sky-500/20 text-sky-400 border-sky-500/30",
  institutional: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  ngo: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  original_context: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  system: "bg-violet-500/20 text-violet-400 border-violet-500/30",
};

const EVENT_TYPE_ICON: Record<ActivityEventType, typeof Radio> = {
  SIGNAL_RECEIVED: Radio,
  COVERAGE_ACTIVITY_EVENT: ShieldCheck,
  STATUS_CHANGE: ArrowRightLeft,
};

const EVENT_TYPE_LABEL: Record<ActivityEventType, string> = {
  SIGNAL_RECEIVED: "Signal received",
  COVERAGE_ACTIVITY_EVENT: "Coverage activity",
  STATUS_CHANGE: "Status change",
};

const GROUPING_WINDOW_MS = 60_000;

// ─── Grouping logic ─────────────────────────────────────────────

type GroupedLogEntry = {
  main: CapabilityActivityLogEntry;
  related: CapabilityActivityLogEntry[];
};

function groupEntries(entries: CapabilityActivityLogEntry[]): GroupedLogEntry[] {
  const consumed = new Set<string>();
  const groups: GroupedLogEntry[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (consumed.has(entry.id)) continue;

    if (entry.event_type === "STATUS_CHANGE") {
      const mainTs = new Date(entry.timestamp).getTime();
      const related: CapabilityActivityLogEntry[] = [];

      for (let j = i + 1; j < entries.length; j++) {
        const candidate = entries[j];
        if (consumed.has(candidate.id)) continue;
        if (candidate.event_type === "STATUS_CHANGE") break;

        const delta = Math.abs(mainTs - new Date(candidate.timestamp).getTime());
        if (delta > GROUPING_WINDOW_MS) break;

        related.push(candidate);
        consumed.add(candidate.id);
      }

      consumed.add(entry.id);
      groups.push({ main: entry, related });
    } else {
      consumed.add(entry.id);
      groups.push({ main: entry, related: [] });
    }
  }

  return groups;
}

// ─── Small presentational pieces ────────────────────────────────

function StatusDot({ status }: { status: string }) {
  const presentation = NEED_STATUS_PRESENTATION[status as NeedStatus];
  if (!presentation) return null;
  return (
    <span className={`inline-block w-2.5 h-2.5 rounded-full ${presentation.dot}`} />
  );
}

function StatusTransition({ previous, final }: { previous: string; final: string }) {
  const prevPres = NEED_STATUS_PRESENTATION[previous as NeedStatus];
  const finalPres = NEED_STATUS_PRESENTATION[final as NeedStatus];
  if (!prevPres || !finalPres) return null;

  return (
    <span className="inline-flex items-center gap-1.5">
      <StatusDot status={previous} />
      <span className={`text-xs font-medium ${prevPres.text}`}>{prevPres.label}</span>
      <ArrowRight className="w-3 h-3 text-muted-foreground" />
      <StatusDot status={final} />
      <span className={`text-xs font-medium ${finalPres.text}`}>{finalPres.label}</span>
    </span>
  );
}

function SourceBadge({ sourceType }: { sourceType: ActivitySourceType }) {
  const SourceIcon = SOURCE_ICON[sourceType];
  const badgeStyle = SOURCE_BADGE_STYLE[sourceType];
  const label = SOURCE_TYPE_LABELS[sourceType];
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${badgeStyle}`}>
      <SourceIcon className="w-3 h-3 mr-1" />
      {label}
    </Badge>
  );
}

// ─── Entry renderers ────────────────────────────────────────────

function RelatedSignalItem({ entry }: { entry: CapabilityActivityLogEntry }) {
  const EventIcon = EVENT_TYPE_ICON[entry.event_type];
  const sourceLabel = SOURCE_TYPE_LABELS[entry.source_type];

  return (
    <div className="flex items-start gap-2 text-xs">
      <EventIcon className="w-3 h-3 mt-0.5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-muted-foreground">{EVENT_TYPE_LABEL[entry.event_type]}</span>
          <SourceBadge sourceType={entry.source_type} />
        </div>
        <p className="text-foreground/80 line-clamp-2">
          <span className="font-medium">{sourceLabel}:</span> {entry.summary}
        </p>
      </div>
    </div>
  );
}

function ActivityLogItem({ entry }: { entry: CapabilityActivityLogEntry }) {
  const EventIcon = EVENT_TYPE_ICON[entry.event_type];
  const sourceLabel = SOURCE_TYPE_LABELS[entry.source_type];

  const timeAgo = formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true });

  const showStatusTransition =
    entry.event_type === "STATUS_CHANGE" &&
    entry.previous_status &&
    entry.final_status;

  const isNoOp = showStatusTransition && entry.previous_status === entry.final_status;

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <EventIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs text-muted-foreground">{EVENT_TYPE_LABEL[entry.event_type]}</span>
        <SourceBadge sourceType={entry.source_type} />
      </div>

      {/* Body */}
      {showStatusTransition && isNoOp ? (
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{sourceLabel}:</span>
          <span className="inline-flex items-center gap-1.5">
            <StatusDot status={entry.final_status!} />
            <span className={`text-xs font-medium ${NEED_STATUS_PRESENTATION[entry.final_status as NeedStatus]?.text ?? ""}`}>
              {NEED_STATUS_PRESENTATION[entry.final_status as NeedStatus]?.label ?? entry.final_status}
            </span>
            <span className="text-[10px] text-muted-foreground italic">(re-evaluated, no change)</span>
          </span>
        </div>
      ) : showStatusTransition ? (
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{sourceLabel}:</span>
          <StatusTransition previous={entry.previous_status!} final={entry.final_status!} />
        </div>
      ) : (
        <p className="text-sm text-foreground">
          <span className="font-medium">{sourceLabel}:</span> {entry.summary}
        </p>
      )}

      {/* Reasoning */}
      {entry.event_type === "STATUS_CHANGE" && entry.reasoning_summary && (
        <div className="flex items-start gap-1.5 text-xs bg-muted/50 rounded px-2 py-1.5 text-muted-foreground mt-1">
          <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary/60" />
          <div className="space-y-1">
            <p>{entry.reasoning_summary}</p>
          </div>
        </div>
      )}

      {/* Timestamp */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <time dateTime={entry.timestamp}>{timeAgo}</time>
        {entry.metadata?.batch_processed_at && (
          <>
            <span>·</span>
            <span>Batch processed</span>
          </>
        )}
      </div>
    </>
  );
}

function GroupedCard({ group }: { group: GroupedLogEntry }) {
  return (
    <div className="bg-muted/30 rounded-md p-3 space-y-2">
      <ActivityLogItem entry={group.main} />

      {group.related.length > 0 && (
        <div className="mt-2 ml-1 border-l-2 border-primary/20 pl-3 space-y-2">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Triggered by
          </span>
          {group.related.map((r) => (
            <RelatedSignalItem key={r.id} entry={r} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Modal ──────────────────────────────────────────────────────

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

  const grouped = groupEntries(entries);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Activity log: {gap.capacity_type?.name}</DialogTitle>
          <DialogDescription>
            {gap.sector?.canonical_name} — Signal and decision history
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-3 pr-4">
            {isLoading && (
              <p className="text-sm text-muted-foreground text-center py-8">Loading records…</p>
            )}
            {!isLoading && grouped.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No activity records for this need
              </p>
            )}
            {!isLoading && grouped.map((g) => (
              <GroupedCard key={g.main.id} group={g} />
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

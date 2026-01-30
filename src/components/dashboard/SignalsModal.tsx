import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Users, Shield, MessageSquare, Newspaper } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { Signal, SignalType } from "@/types/database";
import type { GapWithDetails } from "@/services/gapService";

const SIGNAL_TYPE_INFO: Record<
  SignalType,
  { label: string; icon: typeof Users; order: number }
> = {
  field_report: { label: "Actores en terreno", icon: Users, order: 1 },
  actor_report: { label: "Coordinación territorial", icon: Shield, order: 2 },
  sms: { label: "Reportes ciudadanos (SMS)", icon: MessageSquare, order: 3 },
  news: { label: "Contexto informativo (medios)", icon: Newspaper, order: 4 },
  official: { label: "Fuente oficial", icon: Shield, order: 5 },
  context: { label: "Contexto inicial", icon: Newspaper, order: 6 },
  social: { label: "Redes sociales", icon: MessageSquare, order: 7 },
};

interface SignalsModalProps {
  gap: GapWithDetails | null;
  signals: Signal[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SignalsModal({
  gap,
  signals,
  open,
  onOpenChange,
}: SignalsModalProps) {
  if (!gap) return null;

  // Group signals by type
  const groupedSignals = signals.reduce((acc, signal) => {
    const type = signal.signal_type as SignalType;
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(signal);
    return acc;
  }, {} as Record<SignalType, Signal[]>);

  // Sort groups by order defined in SIGNAL_TYPE_INFO
  const sortedTypes = Object.keys(groupedSignals).sort((a, b) => {
    const orderA = SIGNAL_TYPE_INFO[a as SignalType]?.order || 99;
    const orderB = SIGNAL_TYPE_INFO[b as SignalType]?.order || 99;
    return orderA - orderB;
  }) as SignalType[];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Señales: {gap.capacity_type?.name} en {gap.sector?.canonical_name}
          </DialogTitle>
          <DialogDescription>
            Evidencia que sustenta esta brecha
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-6 pr-4">
            {sortedTypes.map((type, index) => {
              const typeInfo = SIGNAL_TYPE_INFO[type];
              const Icon = typeInfo?.icon || MessageSquare;
              const typeSignals = groupedSignals[type];

              return (
                <div key={type}>
                  {index > 0 && <Separator className="mb-6" />}

                  {/* Type header */}
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">
                      {typeInfo?.label || type}
                    </span>
                  </div>

                  {/* Signals in this group */}
                  <div className="space-y-3">
                    {typeSignals.map((signal) => (
                      <SignalItem key={signal.id} signal={signal} />
                    ))}
                  </div>
                </div>
              );
            })}

            {sortedTypes.length === 0 && (
              <p className="text-muted-foreground text-center py-8">
                No hay señales registradas para esta brecha
              </p>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

interface SignalItemProps {
  signal: Signal;
}

function SignalItem({ signal }: SignalItemProps) {
  const timeAgo = formatDistanceToNow(new Date(signal.created_at), {
    addSuffix: true,
    locale: es,
  });

  return (
    <div className="bg-muted/30 rounded-md p-3">
      <p className="text-sm text-foreground">{signal.content}</p>
      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
        <span>{signal.source}</span>
        <span>·</span>
        <span>{timeAgo}</span>
      </div>
    </div>
  );
}

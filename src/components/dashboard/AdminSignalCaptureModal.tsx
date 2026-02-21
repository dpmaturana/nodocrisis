import { useState } from "react";
import {
  Mic,
  MessageSquare,
  Send,
  CheckCircle2,
  Loader2,
  MapPin,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  PauseCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { fieldReportService } from "@/services/fieldReportService";
import { AudioRecorder } from "@/components/field/AudioRecorder";
import type { GapWithDetails } from "@/services/gapService";
import { NEED_STATUS_PRESENTATION, type NeedStatus } from "@/lib/needStatus";

type OperationStatus = "funciona" | "no_alcanza" | "suspender";

const OPERATION_STATUS_OPTIONS: {
  value: OperationStatus;
  Icon: typeof CheckCircle;
  label: string;
  sublabel: string;
}[] = [
  {
    value: "funciona",
    Icon: CheckCircle,
    label: "Funciona",
    sublabel: "por ahora",
  },
  {
    value: "no_alcanza",
    Icon: AlertTriangle,
    label: "No alcanza",
    sublabel: "",
  },
  {
    value: "suspender",
    Icon: PauseCircle,
    label: "Tuvimos que",
    sublabel: "suspender",
  },
];

interface AdminSignalCaptureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectorId: string;
  sectorName: string;
  eventId: string;
  eventName: string;
  eventLocation: string | null;
  gaps: GapWithDetails[];
  sectorNeedStatus?: NeedStatus;
}

export function AdminSignalCaptureModal({
  open,
  onOpenChange,
  sectorId,
  sectorName,
  eventId,
  eventName,
  eventLocation,
  gaps,
  sectorNeedStatus = "WHITE",
}: AdminSignalCaptureModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [operationStatus, setOperationStatus] = useState<OperationStatus | null>(null);
  const [textNote, setTextNote] = useState("");
  const [showAudio, setShowAudio] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sectorStatus = NEED_STATUS_PRESENTATION[sectorNeedStatus];

  const canSubmit = !isSubmitting && (!!textNote.trim() || !!operationStatus);

  const handleSendReport = async () => {
    if (!user || !canSubmit) return;

    const parts: string[] = [];
    if (operationStatus) {
      const opt = OPERATION_STATUS_OPTIONS.find((o) => o.value === operationStatus);
      if (opt) parts.push(`Estado de operación: ${opt.label}${opt.sublabel ? " (" + opt.sublabel + ")" : ""}`);
    }
    if (textNote.trim()) parts.push(textNote.trim());
    const noteText = parts.join("\n\n");

    setIsSubmitting(true);
    try {
      const report = await fieldReportService.createTextOnlyReport(
        { event_id: eventId, sector_id: sectorId, text_note: noteText, signal_type: "official" },
        user.id,
      );

      toast({
        title: "Reporte enviado",
        description: "Tu reporte ayudará a ajustar la coordinación en tiempo real.",
      });
      resetForm();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error al enviar reporte",
        description: error.message || "No se pudo enviar el reporte",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setOperationStatus(null);
    setTextNote("");
    setShowAudio(false);
  };

  const handleCompleteOperation = () => {
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        {/* ── Sector header ────────────────────────────── */}
        <DialogHeader className="space-y-1 pb-0">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
            <DialogTitle className="text-lg leading-tight">{sectorName}</DialogTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            {eventName}
            {eventLocation ? ` · ${eventLocation}` : ""}
          </p>
          <div className="flex items-center gap-2 pt-1">
            <Badge variant="destructive" className="gap-1 text-xs">
              <AlertCircle className="w-3 h-3" />
              {sectorStatus.shortLabel}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Gap remains active based on available signals
            </span>
          </div>
        </DialogHeader>

        <Separator />

        {/* ── Actualizar estado de terreno ─────────────── */}
        <div className="space-y-4">
          <div className="flex items-start gap-2">
            <Mic className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Actualizar estado de terreno</p>
              <p className="text-xs text-muted-foreground">
                Tu reporte ayuda a ajustar la coordinación en tiempo real.
              </p>
            </div>
          </div>

          {/* Operation status selector */}
          <div className="space-y-2">
            <p className="text-sm font-medium">
              ¿Cómo va tu operación?{" "}
              <span className="text-destructive">*</span>
            </p>
            <div className="grid grid-cols-3 gap-2">
              {OPERATION_STATUS_OPTIONS.map(({ value, Icon, label, sublabel }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setOperationStatus((prev) => (prev === value ? null : value))
                  }
                  className={cn(
                    "flex flex-col items-center gap-1.5 p-3 rounded-lg border text-center transition-all",
                    operationStatus === value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card hover:bg-muted/50 text-foreground",
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs font-medium leading-tight">{label}</span>
                  {sublabel && (
                    <span className="text-[10px] text-muted-foreground leading-tight">
                      {sublabel}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Optional audio */}
          <div className="space-y-2">
            <button
              type="button"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowAudio((v) => !v)}
            >
              <Mic className="w-4 h-4" />
              Agregar audio (opcional)
            </button>
            {showAudio && user && (
              <AudioRecorder
                eventId={eventId}
                sectorId={sectorId}
                actorId={user.id}
                onReportCreated={() => {
                  toast({
                    title: "Audio enviado",
                    description: "Tu reporte de audio está siendo procesado.",
                  });
                  resetForm();
                  onOpenChange(false);
                }}
              />
            )}
          </div>

          {/* Optional text note */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MessageSquare className="w-4 h-4" />
              Agregar nota (opcional)
            </div>
            <Textarea
              placeholder="Ej: Llegamos hace 1 hora, falta agua..."
              value={textNote}
              onChange={(e) => setTextNote(e.target.value)}
              className="min-h-[80px] resize-none"
            />
          </div>

          {/* Send report */}
          <Button
            className="w-full gap-2"
            onClick={handleSendReport}
            disabled={!canSubmit}
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Enviar reporte
          </Button>
        </div>

        <Separator />

        {/* ── Complete operation ───────────────────────── */}
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={handleCompleteOperation}
        >
          <CheckCircle2 className="w-4 h-4" />
          Complete operation
        </Button>
      </DialogContent>
    </Dialog>
  );
}

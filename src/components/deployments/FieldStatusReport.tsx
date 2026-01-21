import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Mic, Square, Play, X, CheckCircle, AlertTriangle, Pause, Loader2, Send } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { fieldReportService } from "@/services/fieldReportService";
import { deploymentService } from "@/services/deploymentService";
import type { SectorDeploymentGroup } from "@/services/deploymentService";

type StatusOption = "working" | "insufficient" | "suspended" | null;

interface FieldStatusReportProps {
  group: SectorDeploymentGroup;
  actorId: string;
  onReportSent: () => void;
}

const MAX_RECORDING_SECONDS = 180;

export function FieldStatusReport({ group, actorId, onReportSent }: FieldStatusReportProps) {
  const { toast } = useToast();
  
  // Form state
  const [statusOption, setStatusOption] = useState<StatusOption>(null);
  const [textNote, setTextNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Audio state
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingSeconds(0);
      
      intervalRef.current = setInterval(() => {
        setRecordingSeconds(prev => {
          if (prev >= MAX_RECORDING_SECONDS - 1) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (error) {
      toast({
        title: "Error de micrófono",
        description: "No se pudo acceder al micrófono.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const clearAudio = () => {
    setAudioBlob(null);
    setRecordingSeconds(0);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlaying(false);
  };

  const playAudio = () => {
    if (!audioBlob) return;
    
    const audio = new Audio(URL.createObjectURL(audioBlob));
    audioRef.current = audio;
    
    audio.onended = () => setIsPlaying(false);
    audio.play();
    setIsPlaying(true);
  };

  const stopPlaying = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
  };

  const handleSubmit = async () => {
    if (!statusOption) return;
    
    setIsSubmitting(true);
    
    try {
      // 1. If there's audio, create field report and trigger transcription
      if (audioBlob) {
        const report = await fieldReportService.createReport({
          event_id: group.event.id,
          sector_id: group.sector.id,
          audio_file: audioBlob,
        }, actorId);
        
        // Trigger transcription in background
        fieldReportService.triggerTranscription(report.id).catch(console.error);
      }
      
      // 2. Update deployment statuses based on selected option
      for (const deployment of group.deployments) {
        if (deployment.status === "operating" || deployment.status === "confirmed" || deployment.status === "interested") {
          if (statusOption === "suspended") {
            // Handle suspension separately
            const noteToSave = textNote || "Operación suspendida";
            await deploymentService.updateStatusWithNote(deployment.id, "suspended", noteToSave);
          } else {
            // Working or insufficient - keep/upgrade to operating
            const newStatus = deployment.status !== "operating" ? "operating" : "operating";
            const noteToSave = textNote || (statusOption === "insufficient" ? "Recursos insuficientes" : undefined);
            await deploymentService.updateStatusWithNote(deployment.id, newStatus, noteToSave);
          }
        }
      }
      
      toast({
        title: "Reporte enviado",
        description: statusOption === "suspended" 
          ? "Tu operación ha sido suspendida." 
          : "Tu actualización ha sido registrada.",
      });
      
      // Reset form
      setStatusOption(null);
      setTextNote("");
      clearAudio();
      
      onReportSent();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo enviar el reporte.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = statusOption !== null && !isSubmitting;

  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
      <div>
        <h4 className="font-medium text-sm flex items-center gap-2">
          <Mic className="w-4 h-4 text-primary" />
          Actualizar estado de terreno
        </h4>
        <p className="text-xs text-muted-foreground mt-1">
          Tu reporte ayuda a ajustar la coordinación en tiempo real.
        </p>
      </div>

      {/* Status Options - Required */}
      <div className="space-y-2">
        <label className="text-sm font-medium">
          ¿Cómo va tu operación? <span className="text-destructive">*</span>
        </label>
        <div className="grid grid-cols-3 gap-2">
          <StatusButton
            selected={statusOption === "working"}
            onClick={() => setStatusOption("working")}
            icon={<CheckCircle className="w-5 h-5" />}
            label="Funciona"
            sublabel="por ahora"
            variant="success"
          />
          <StatusButton
            selected={statusOption === "insufficient"}
            onClick={() => setStatusOption("insufficient")}
            icon={<AlertTriangle className="w-5 h-5" />}
            label="No alcanza"
            sublabel=""
            variant="warning"
          />
          <StatusButton
            selected={statusOption === "suspended"}
            onClick={() => setStatusOption("suspended")}
            icon={<Pause className="w-5 h-5" />}
            label="Tuvimos que"
            sublabel="suspender"
            variant="muted"
          />
        </div>
      </div>

      {/* Audio Recording - Optional */}
      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">
          🎙️ Agregar audio (opcional)
        </label>
        <div className="flex items-center gap-2">
          {!audioBlob && !isRecording && (
            <Button
              variant="outline"
              size="sm"
              onClick={startRecording}
              className="gap-2"
            >
              <Mic className="w-4 h-4 text-destructive" />
              Grabar
            </Button>
          )}
          
          {isRecording && (
            <>
              <Button
                variant="destructive"
                size="sm"
                onClick={stopRecording}
                className="gap-2"
              >
                <Square className="w-4 h-4" />
                {formatTime(recordingSeconds)}
              </Button>
              <span className="text-xs text-muted-foreground animate-pulse">
                Grabando...
              </span>
            </>
          )}
          
          {audioBlob && !isRecording && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={isPlaying ? stopPlaying : playAudio}
                className="gap-2"
              >
                {isPlaying ? (
                  <Square className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                {formatTime(recordingSeconds)}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAudio}
                className="h-8 w-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Text Note - Optional */}
      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">
          💬 Agregar nota (opcional)
        </label>
        <Textarea
          placeholder="Ej: Llegamos hace 1 hora, falta agua..."
          value={textNote}
          onChange={(e) => setTextNote(e.target.value)}
          rows={2}
          className="resize-none"
        />
      </div>

      {/* Submit */}
      <Button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full gap-2"
      >
        {isSubmitting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Send className="w-4 h-4" />
        )}
        Enviar reporte
      </Button>
    </div>
  );
}

interface StatusButtonProps {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  variant: "success" | "warning" | "muted";
}

function StatusButton({ selected, onClick, icon, label, sublabel, variant }: StatusButtonProps) {
  const variantStyles = {
    success: selected 
      ? "border-green-500 bg-green-500/10 text-green-700 dark:text-green-400" 
      : "hover:border-green-500/50 hover:bg-green-500/5",
    warning: selected 
      ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400" 
      : "hover:border-amber-500/50 hover:bg-amber-500/5",
    muted: selected 
      ? "border-muted-foreground bg-muted text-muted-foreground" 
      : "hover:border-muted-foreground/50 hover:bg-muted/50",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-1 p-3 rounded-lg border-2 transition-all",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        variantStyles[variant]
      )}
    >
      {icon}
      <span className="text-xs font-medium">{label}</span>
      {sublabel && <span className="text-[10px] opacity-70">{sublabel}</span>}
    </button>
  );
}

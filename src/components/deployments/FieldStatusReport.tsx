import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Mic, Square, Play, X, CheckCircle, AlertTriangle, Pause, Loader2, Send, RotateCcw, ChevronDown } from "@/lib/icons";
import { CompletedReportView } from "./CompletedReportView";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { fieldReportService } from "@/services/fieldReportService";
import { supabase } from "@/integrations/supabase/client";
import type { SectorDeploymentGroup } from "@/services/deploymentService";
import type { FieldReport, ExtractedData } from "@/types/fieldReport";

type StatusOption = "working" | "insufficient" | "suspended" | null;
type ProcessingState = "idle" | "sending" | "transcribing" | "completed" | "error";

interface FieldStatusReportProps {
  group: SectorDeploymentGroup;
  actorId: string;
  onReportSent: () => void;
}

const MAX_RECORDING_SECONDS = 180;

export function FieldStatusReport({ group, actorId, onReportSent }: FieldStatusReportProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  
  // Form state
  const [statusOption, setStatusOption] = useState<StatusOption>(null);
  const [textNote, setTextNote] = useState("");
  
  // Processing state
  const [processingState, setProcessingState] = useState<ProcessingState>("idle");
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);
  const [completedReport, setCompletedReport] = useState<FieldReport | null>(null);
  
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
        title: "Microphone error",
        description: "Could not access the microphone.",
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

  const resetForm = () => {
    setProcessingState("idle");
    setProcessingStatus(null);
    setCompletedReport(null);
    setStatusOption(null);
    setTextNote("");
    clearAudio();
    onReportSent();
  };

  const handleSubmit = async () => {
    setProcessingState("sending");
    
    const statusLabels: Record<NonNullable<StatusOption>, string> = {
      working: "Working for now",
      insufficient: "Insufficient",
      suspended: "Had to suspend",
    };
    let fullNote = textNote;
    if (statusOption) {
      const statusText = statusLabels[statusOption];
      fullNote = statusText + (textNote ? "\n\n" + textNote : "");
    }
    const isValidUUID = (str: string) => 
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    
    try {
      let reportWithResults: FieldReport | null = null;
      const eventId = group.event.id;
      const sectorId = group.sector.id;
      const hasValidIds = isValidUUID(eventId) && isValidUUID(sectorId);
      
      if (hasValidIds) {
        if (audioBlob) {
          const report = await fieldReportService.createReport({
            event_id: eventId,
            sector_id: sectorId,
            audio_file: audioBlob,
            text_note: fullNote || undefined,
          }, actorId);
        
          setProcessingState("transcribing");
          
          await fieldReportService.triggerTranscription(report.id);
          
          reportWithResults = await fieldReportService.pollStatus(
            report.id,
            (updatedReport) => {
              setProcessingStatus(updatedReport.status);
            }
          );
        } else if (fullNote.trim()) {
          setProcessingState("transcribing");
          setProcessingStatus("extracting");
          
          reportWithResults = await fieldReportService.createTextOnlyReport({
            event_id: eventId,
            sector_id: sectorId,
            text_note: fullNote,
          }, actorId);
        }
      } else if (fullNote.trim()) {
        console.warn("Using dry-run mode for AI extraction", { eventId, sectorId });
        
        setProcessingState("transcribing");
        setProcessingStatus("extracting");
        
        try {
          const { data, error } = await supabase.functions.invoke('extract-text-report', {
            body: { 
              event_id: eventId,
              sector_id: sectorId,
              actor_id: actorId,
              text_note: fullNote,
              dry_run: true,
            },
          });
          
          if (error) {
            console.error('Dry-run extraction error:', error);
            throw new Error(error.message);
          }
          
          if (data?.success && data?.report) {
            reportWithResults = {
              id: data.report.id || `mock-${Date.now()}`,
              event_id: eventId,
              sector_id: sectorId,
              actor_id: actorId,
              audio_url: 'text-only',
              transcript: null,
              text_note: fullNote,
              status: 'completed',
              extracted_data: data.extracted_data as ExtractedData,
              error_message: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
          }
        } catch (e) {
          console.error('Dry-run failed, using fallback mock:', e);
          reportWithResults = {
            id: `mock-${Date.now()}`,
            event_id: eventId,
            sector_id: sectorId,
            actor_id: actorId,
            audio_url: 'text-only',
            transcript: null,
            text_note: fullNote,
            status: 'completed',
            extracted_data: {
              sector_mentioned: null,
              capability_types: [],
              items: [],
              location_detail: null,
              observations: fullNote,
              evidence_quotes: [],
              confidence: 0.5,
            },
            error_message: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        }
        
        toast({
          title: "Test mode",
          description: "Processed with AI but not persisted to database.",
        });
      } else if (audioBlob) {
        console.warn("Audio requires real IDs for storage", { eventId, sectorId });
        toast({
          title: "Test mode",
          description: "Audio requires real IDs for storage.",
          variant: "default",
        });
      }
      
      setProcessingState("completed");
      setCompletedReport(reportWithResults);
      
      toast({
        title: "Report sent",
        description: statusOption === "suspended" 
          ? "Your operation has been suspended." 
          : "Your update has been registered.",
      });
      
    } catch (error: any) {
      setProcessingState("error");
      toast({
        title: "Error",
        description: error.message || "Could not send the report.",
        variant: "destructive",
      });
    }
  };

  const isProcessing = processingState === "sending" || processingState === "transcribing";
  const canSubmit = !isProcessing && (!!audioBlob || textNote.trim() !== "" || statusOption !== null);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="space-y-0 p-4 bg-muted/30 rounded-lg border">
      <CollapsibleTrigger className="flex items-center justify-between w-full">
        <h4 className="font-medium text-sm flex items-center gap-2">
          <Mic className="w-4 h-4 text-primary" />
          Update field status
        </h4>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
      </CollapsibleTrigger>

      <CollapsibleContent className="space-y-4 pt-3">
        <p className="text-xs text-muted-foreground">
          Your report helps adjust coordination in real time.
        </p>

        {/* Show editing controls only in idle state */}
        {processingState === "idle" && (
          <>
            {/* Status Options - Optional */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                How is your operation going? <span className="text-muted-foreground text-xs">(optional)</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                <StatusButton
                  selected={statusOption === "working"}
                  onClick={() => setStatusOption("working")}
                  icon={<CheckCircle className="w-5 h-5" />}
                  label="Working"
                  sublabel=""
                  variant="success"
                />
                <StatusButton
                  selected={statusOption === "insufficient"}
                  onClick={() => setStatusOption("insufficient")}
                  icon={<AlertTriangle className="w-5 h-5" />}
                  label="Insufficient"
                  sublabel=""
                  variant="warning"
                />
                <StatusButton
                  selected={statusOption === "suspended"}
                  onClick={() => setStatusOption("suspended")}
                  icon={<Pause className="w-5 h-5" />}
                  label="Had to"
                  sublabel="suspend"
                  variant="muted"
                />
              </div>
            </div>

            {/* Audio Recording - Optional */}
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">
                🎙️ Add audio (optional)
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
                    Record
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
                      Recording...
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
                💬 Add note (optional)
              </label>
              <Textarea
                placeholder="E.g.: Arrived 1 hour ago, water is lacking..."
                value={textNote}
                onChange={(e) => setTextNote(e.target.value)}
                rows={2}
                className="resize-none"
              />
            </div>
          </>
        )}

        {/* Processing State: Transcribing with detailed status */}
        {processingState === "transcribing" && (
          <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg border">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <div>
              <p className="text-sm font-medium">
                {processingStatus === 'transcribing' && 'Transcribing audio...'}
                {processingStatus === 'extracting' && 'Extracting information...'}
                {(!processingStatus || processingStatus === 'pending') && 'Uploading audio...'}
              </p>
              <p className="text-xs text-muted-foreground">
                {processingStatus === 'transcribing' && 'Converting speech to text'}
                {processingStatus === 'extracting' && 'Analyzing content with AI'}
                {(!processingStatus || processingStatus === 'pending') && 'Preparing transcription'}
              </p>
            </div>
          </div>
        )}

        {/* Completed State: Show Results */}
        {processingState === "completed" && completedReport && (
          <CompletedReportView 
            completedReport={completedReport}
            textNote={textNote}
            sectorName={group.sector.canonical_name}
            onReset={resetForm}
          />
        )}

        {/* Completed without audio - simple success */}
        {processingState === "completed" && !completedReport && (
          <div className="space-y-3 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">Report sent successfully</span>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={resetForm}
              className="w-full gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Send another report
            </Button>
          </div>
        )}

        {/* Submit Button - Only show in idle state */}
        {processingState === "idle" && (
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full gap-2"
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Send report
          </Button>
        )}

        {/* Sending State */}
        {processingState === "sending" && (
          <Button disabled className="w-full gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Sending...
          </Button>
        )}
      </CollapsibleContent>
    </Collapsible>
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

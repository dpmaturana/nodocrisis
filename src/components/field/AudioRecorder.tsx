import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mic, Square, Loader2, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { fieldReportService } from "@/services/fieldReportService";
import type { FieldReport, FieldReportStatus } from "@/types/fieldReport";
import { cn } from "@/lib/utils";

interface AudioRecorderProps {
  eventId: string;
  sectorId: string;
  actorId: string;
  onReportCreated?: (report: FieldReport) => void;
}

type RecordingState = 'idle' | 'recording' | 'uploading' | 'processing' | 'completed' | 'error';

const MAX_RECORDING_SECONDS = 180; // 3 minutes

export function AudioRecorder({ eventId, sectorId, actorId, onReportCreated }: AudioRecorderProps) {
  const [state, setState] = useState<RecordingState>('idle');
  const [processingStatus, setProcessingStatus] = useState<FieldReportStatus | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<FieldReport | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setState('recording');
      setRecordingTime(0);
      chunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        } 
      });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await processRecording(audioBlob);
      };

      mediaRecorder.start(1000); // Collect data every second

      // Start timer
      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= MAX_RECORDING_SECONDS - 1) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);

    } catch (err: any) {
      console.error('Failed to start recording:', err);
      setError(err.message || 'No se pudo acceder al micrófono');
      setState('error');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const processRecording = async (audioBlob: Blob) => {
    setState('uploading');
    setProcessingStatus('pending');

    try {
      // Upload and create report
      const createdReport = await fieldReportService.createReport(
        { event_id: eventId, sector_id: sectorId, audio_file: audioBlob },
        actorId
      );
      setReport(createdReport);

      // Trigger transcription
      setState('processing');
      await fieldReportService.triggerTranscription(createdReport.id);

      // Poll for completion
      const finalReport = await fieldReportService.pollStatus(
        createdReport.id,
        (updatedReport) => {
          setProcessingStatus(updatedReport.status);
          setReport(updatedReport);
        }
      );

      if (finalReport.status === 'completed') {
        setState('completed');
        onReportCreated?.(finalReport);
      } else {
        setState('error');
        setError(finalReport.error_message || 'Error al procesar el audio');
      }

    } catch (err: any) {
      console.error('Processing error:', err);
      setState('error');
      setError(err.message || 'Error al procesar la grabación');
    }
  };

  const reset = () => {
    setState('idle');
    setProcessingStatus(null);
    setRecordingTime(0);
    setError(null);
    setReport(null);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusLabel = (status: FieldReportStatus): string => {
    const labels: Record<FieldReportStatus, string> = {
      pending: 'Preparando...',
      transcribing: 'Transcribiendo audio...',
      extracting: 'Extrayendo información...',
      completed: 'Completado',
      failed: 'Error',
    };
    return labels[status];
  };

  return (
    <Card className="border-dashed">
      <CardContent className="p-4">
        {/* Idle state - show record button */}
        {state === 'idle' && (
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-muted-foreground text-center">
              Graba un reporte de voz desde el terreno
            </p>
            <Button onClick={startRecording} size="lg" className="gap-2">
              <Mic className="w-5 h-5" />
              Grabar Observación
            </Button>
          </div>
        )}

        {/* Recording state */}
        {state === 'recording' && (
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className={cn(
                "w-20 h-20 rounded-full bg-destructive/20 flex items-center justify-center",
                "animate-pulse"
              )}>
                <Mic className="w-10 h-10 text-destructive" />
              </div>
              <Badge 
                variant="destructive" 
                className="absolute -top-2 -right-2 animate-pulse"
              >
                REC
              </Badge>
            </div>
            <div className="text-2xl font-mono font-bold">
              {formatTime(recordingTime)}
            </div>
            <p className="text-sm text-muted-foreground">
              Máximo {MAX_RECORDING_SECONDS / 60} minutos
            </p>
            <Button 
              onClick={stopRecording} 
              variant="destructive" 
              size="lg" 
              className="gap-2"
            >
              <Square className="w-5 h-5" />
              Detener y Enviar
            </Button>
          </div>
        )}

        {/* Processing states */}
        {(state === 'uploading' || state === 'processing') && (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <div className="text-center">
              <p className="font-medium">
                {processingStatus ? getStatusLabel(processingStatus) : 'Subiendo audio...'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Esto puede tomar unos segundos
              </p>
            </div>
          </div>
        )}

        {/* Completed state */}
        {state === 'completed' && report && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">Reporte procesado exitosamente</span>
            </div>
            
            {report.transcript && (
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">Transcripción:</p>
                <p className="text-sm">{report.transcript}</p>
              </div>
            )}

            {report.extracted_data && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Datos extraídos:</p>
                
                {report.extracted_data.capability_types?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {report.extracted_data.capability_types.map((type, i) => (
                      <Badge key={i} variant="secondary">{type}</Badge>
                    ))}
                  </div>
                )}

                {report.extracted_data.items?.length > 0 && (
                  <ul className="text-sm space-y-1">
                    {report.extracted_data.items.map((item, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span>•</span>
                        <span>
                          {item.quantity && `${item.quantity} `}
                          {item.name}
                          {item.unit && ` (${item.unit})`}
                        </span>
                        <Badge variant={item.urgency === 'crítica' ? 'destructive' : 'outline'} className="text-xs">
                          {item.urgency}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}

                {report.extracted_data.observations && (
                  <p className="text-sm italic text-muted-foreground">
                    "{report.extracted_data.observations}"
                  </p>
                )}
              </div>
            )}

            <Button onClick={reset} variant="outline" className="w-full">
              Grabar otro reporte
            </Button>
          </div>
        )}

        {/* Error state */}
        {state === 'error' && (
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-2 text-destructive">
              <XCircle className="w-5 h-5" />
              <span className="font-medium">Error</span>
            </div>
            <p className="text-sm text-muted-foreground text-center">{error}</p>
            
            {report?.transcript && (
              <div className="bg-muted/50 rounded-lg p-3 w-full">
                <p className="text-xs text-muted-foreground mb-1">Transcripción guardada:</p>
                <p className="text-sm">{report.transcript}</p>
              </div>
            )}
            
            <Button onClick={reset} variant="outline">
              Intentar de nuevo
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { Button } from "@/components/ui/button";
import { CheckCircle, Mic, Users, Droplet, Utensils, HeartPulse, Home, RotateCcw } from "@/lib/icons";
import { MessageSquare, Package } from "lucide-react";
import { StatusBadge, type StatusType } from "@/components/ui/StatusBadge";
import type { FieldReport } from "@/types/fieldReport";

interface CompletedReportViewProps {
  completedReport: FieldReport;
  textNote: string;
  sectorName: string;
  onReset: () => void;
}

const getCapabilityIcon = (capType: string) => {
  const lower = capType.toLowerCase();
  if (lower.includes('agua')) return <Droplet className="w-4 h-4 text-blue-500" />;
  if (lower.includes('alimento')) return <Utensils className="w-4 h-4 text-orange-500" />;
  if (lower.includes('salud')) return <HeartPulse className="w-4 h-4 text-red-500" />;
  if (lower.includes('albergue')) return <Home className="w-4 h-4 text-purple-500" />;
  return <Package className="w-4 h-4 text-muted-foreground" />;
};

export function CompletedReportView({ 
  completedReport, 
  textNote, 
  sectorName,
  onReset 
}: CompletedReportViewProps) {
  
  const getGapStatus = (capType: string): StatusType => {
    const items = completedReport?.extracted_data?.items || [];
    const related = items.find(i => 
      i.name.toLowerCase().includes(capType.toLowerCase()) ||
      capType.toLowerCase().includes(i.name.toLowerCase().split(' ')[0])
    );
    if (related?.urgency === 'crítica') return 'gap-critical';
    if (related?.urgency === 'alta') return 'gap-partial';
    return 'gap-active';
  };

  return (
    <div className="space-y-3 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900">
      <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
        <CheckCircle className="w-5 h-5" />
        <span className="font-medium">Reporte enviado y procesado</span>
      </div>
      
      {/* Text Note - Exact */}
      {textNote && (
        <div className="bg-background/50 rounded p-3">
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <MessageSquare className="w-3 h-3" />
            Tu nota:
          </p>
          <p className="text-sm">{textNote}</p>
        </div>
      )}
      
      {/* Transcription - Exact */}
      {completedReport.transcript && (
        <div className="bg-background/50 rounded p-3">
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <Mic className="w-3 h-3" />
            Transcripción:
          </p>
          <p className="text-sm">{completedReport.transcript}</p>
        </div>
      )}
      
      {/* Signals Registered with Gap Status */}
      {completedReport.extracted_data?.capability_types?.length > 0 && (
        <div className="space-y-2 pt-2 border-t">
          <p className="text-xs text-muted-foreground">Señales registradas:</p>
          <div className="space-y-1.5">
            {completedReport.extracted_data.capability_types.map((capType, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                <div className="flex items-center gap-2">
                  {getCapabilityIcon(capType)}
                  <span className="text-sm font-medium capitalize">{capType}</span>
                </div>
                <StatusBadge status={getGapStatus(capType)} size="sm" />
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Public Summary - What others will see */}
      {completedReport.extracted_data?.observations && (
        <div className="bg-blue-50 dark:bg-blue-950/20 rounded p-3 border border-blue-200 dark:border-blue-900">
          <p className="text-xs text-blue-600 dark:text-blue-400 mb-1 flex items-center gap-1">
            <Users className="w-3 h-3" />
            Lo que verán otros actores:
          </p>
          <p className="text-sm">{completedReport.extracted_data.observations}</p>
        </div>
      )}
      
      {/* Send Another Button */}
      <Button 
        variant="outline" 
        size="sm" 
        onClick={onReset}
        className="w-full gap-2"
      >
        <RotateCcw className="w-4 h-4" />
        Enviar otro reporte
      </Button>
    </div>
  );
}

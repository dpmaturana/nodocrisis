import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertTriangle,
  Check,
  Clock,
  Loader2,
  MapPin,
  Plus,
  Save,
  Trash2,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/hooks/useMockAuth";
import { situationReportService, MOCK_CAPACITY_TYPES } from "@/services";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { InlineEditable } from "@/components/reports/InlineEditable";
import { SuggestedSectorCard } from "@/components/reports/SuggestedSectorCard";
import { CapabilityToggleList } from "@/components/reports/CapabilityToggleList";
import type {
  InitialSituationReport,
  SuggestedSector,
  SuggestedCapability,
  CapacityType,
} from "@/types/database";
import { EVENT_TYPES } from "@/types/database";

export default function SituationReport() {
  const { reportId } = useParams<{ reportId: string }>();
  const { isAdmin, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [report, setReport] = useState<InitialSituationReport | null>(null);
  const [capacityTypes] = useState<CapacityType[]>(MOCK_CAPACITY_TYPES);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  // Determine if we're in draft mode (from mock service) or fetching by ID
  const isDraftMode = reportId === "draft" || !reportId;

  useEffect(() => {
    if (authLoading) return;

    const loadReport = () => {
      if (isDraftMode) {
        // Load from mock service's current draft
        const draft = situationReportService.getCurrentDraft();
        if (draft) {
          setReport(draft);
        } else {
          // No draft available, redirect to create
          navigate("/admin/create-event");
        }
      }
      // Future: if reportId is a real ID, could fetch from backend
      setIsLoading(false);
    };

    loadReport();
  }, [reportId, authLoading, isDraftMode, navigate]);

  if (authLoading || isLoading) {
    return (
      <div className="container max-w-4xl py-8 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!isAdmin) {
    navigate("/dashboard");
    return null;
  }

  if (!report) {
    return (
      <div className="container max-w-4xl py-12 text-center">
        <p className="text-muted-foreground">Reporte no encontrado.</p>
      </div>
    );
  }

  if (report.status !== "draft") {
    return (
      <div className="container max-w-4xl py-12 text-center space-y-4">
        <Badge variant="secondary" className="text-base px-4 py-1">
          {report.status === "confirmed" ? "Confirmado" : "Descartado"}
        </Badge>
        <p className="text-muted-foreground">
          Este reporte ya no puede ser editado.
        </p>
        {report.linked_event_id && (
          <Button onClick={() => navigate(`/admin/event-dashboard`)}>
            Ver dashboard del evento
          </Button>
        )}
      </div>
    );
  }

  const updateReport = (updates: Partial<InitialSituationReport>) => {
    setReport((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      // Also update in service
      situationReportService.updateDraft(updates);
      return updated;
    });
  };

  const handleSaveDraft = async () => {
    if (!report) return;
    setIsSaving(true);
    try {
      await situationReportService.saveDraft(report);
      toast({ title: "Borrador guardado" });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error al guardar",
        description: error.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = async () => {
    if (!report) return;
    try {
      await situationReportService.discard();
      toast({ title: "Reporte descartado" });
      navigate("/admin/create-event");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const handleConfirm = async () => {
    if (!report) return;
    setIsConfirming(true);

    try {
      const { eventId } = await situationReportService.confirm(report);

      toast({
        title: "¡Coordinación activada!",
        description: `Evento "${report.event_name_suggested}" creado exitosamente.`,
      });

      // Navigate to mock event dashboard
      navigate(`/admin/event-dashboard`);
    } catch (error: any) {
      console.error("Error confirming report:", error);
      toast({
        variant: "destructive",
        title: "Error al confirmar",
        description: error.message,
      });
    } finally {
      setIsConfirming(false);
    }
  };

  // Sector handlers
  const handleUpdateSector = (index: number, sector: SuggestedSector) => {
    const updated = [...report.suggested_sectors];
    updated[index] = sector;
    updateReport({ suggested_sectors: updated });
  };

  const handleRemoveSector = (index: number) => {
    const updated = report.suggested_sectors.filter((_, i) => i !== index);
    updateReport({ suggested_sectors: updated });
  };

  const handleDuplicateSector = (sector: SuggestedSector) => {
    updateReport({
      suggested_sectors: [
        ...report.suggested_sectors,
        { ...sector, name: `${sector.name} (copia)`, confidence: 1 },
      ],
    });
  };

  const handleAddSector = () => {
    updateReport({
      suggested_sectors: [
        ...report.suggested_sectors,
        {
          name: "Nuevo sector",
          description: "",
          confidence: 1,
          include: true,
        },
      ],
    });
  };

  const confidencePercent = report.overall_confidence
    ? Math.round(report.overall_confidence * 100)
    : 0;

  const includedSectorsCount = report.suggested_sectors.filter((s) => s.include).length;
  const includedCapabilitiesCount = report.suggested_capabilities.filter((c) => c.include).length;

  return (
    <div className="container max-w-4xl py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" />
            Borrador
          </Badge>
          <span className="text-sm text-muted-foreground">
            Generado: {format(new Date(report.created_at), "d MMM yyyy, HH:mm", { locale: es })}
          </span>
          {report.overall_confidence && (
            <Badge variant="secondary" className="font-mono">
              Confianza: {confidencePercent}%
            </Badge>
          )}
        </div>
        <h1 className="text-2xl font-bold">Reporte de Situación Inicial</h1>
      </div>

      {/* Event Details */}
      <Card className="mb-6 glass">
        <CardHeader>
          <CardTitle className="text-lg">Evento Sugerido</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Nombre del evento
            </label>
            <InlineEditable
              value={report.event_name_suggested || ""}
              onChange={(v) => updateReport({ event_name_suggested: v })}
              placeholder="Ingresa el nombre del evento..."
              className="text-xl font-semibold mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Tipo de emergencia
            </label>
            <Select
              value={report.event_type || ""}
              onValueChange={(v) => updateReport({ event_type: v })}
            >
              <SelectTrigger className="mt-1 w-full max-w-xs">
                <SelectValue placeholder="Seleccionar tipo..." />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Resumen de la situación
            </label>
            <InlineEditable
              value={report.summary || ""}
              onChange={(v) => updateReport({ summary: v })}
              placeholder="Describe la situación..."
              multiline
              className="text-foreground mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Sectors */}
      <Card className="mb-6 glass">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">
              Sectores Operativos Sugeridos
            </CardTitle>
            <Badge variant="secondary">{includedSectorsCount} incluidos</Badge>
          </div>
          <Button size="sm" variant="outline" onClick={handleAddSector}>
            <Plus className="h-4 w-4 mr-1" />
            Agregar
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {report.suggested_sectors.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hay sectores sugeridos. Agrega uno manualmente.
            </p>
          ) : (
            report.suggested_sectors.map((sector, index) => (
              <SuggestedSectorCard
                key={index}
                sector={sector}
                index={index}
                onUpdate={handleUpdateSector}
                onRemove={handleRemoveSector}
                onDuplicate={handleDuplicateSector}
              />
            ))
          )}
        </CardContent>
      </Card>

      {/* Capabilities */}
      <Card className="mb-6 glass">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">
              Capacidades Críticas (Nivel Evento)
            </CardTitle>
            <Badge variant="secondary">{includedCapabilitiesCount} incluidas</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Estas capacidades se requieren para el evento completo. Después podrás asignar prioridades por sector.
          </p>
        </CardHeader>
        <CardContent>
          <CapabilityToggleList
            capabilities={report.suggested_capabilities}
            allCapacityTypes={capacityTypes}
            onUpdate={(caps) => updateReport({ suggested_capabilities: caps })}
          />
        </CardContent>
      </Card>

      {/* Warning notice */}
      <Card className="mb-6 border-warning/50 bg-warning/5">
        <CardContent className="flex items-start gap-3 pt-6">
          <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Esta es una propuesta generada por IA</p>
            <p className="text-sm text-muted-foreground">
              Revisa la información antes de confirmar. Al activar la coordinación se crearán el evento, los sectores y las necesidades en el sistema.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          size="lg"
          className="flex-1 gap-2"
          onClick={handleConfirm}
          disabled={isConfirming || isSaving}
        >
          {isConfirming ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creando evento...
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              Confirmar y Activar Coordinación
            </>
          )}
        </Button>

        <Button
          variant="outline"
          size="lg"
          onClick={handleSaveDraft}
          disabled={isSaving || isConfirming}
          className="gap-2"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Guardar Borrador
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="lg"
              className="text-destructive hover:text-destructive gap-2"
              disabled={isConfirming || isSaving}
            >
              <Trash2 className="h-4 w-4" />
              Descartar
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Descartar reporte?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. El reporte será marcado como descartado.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDiscard}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Descartar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

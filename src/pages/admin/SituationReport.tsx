import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
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
import { useAuth } from "@/hooks/useAuth";
import { situationReportService } from "@/services";
import { supabase } from "@/integrations/supabase/client";
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
  const [capacityTypes, setCapacityTypes] = useState<CapacityType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    const loadReport = async () => {
      try {
        if (!reportId || reportId === "draft") {
          navigate("/admin/create-event");
          return;
        }

        const fetched = await situationReportService.fetchById(reportId);
        if (fetched) {
          setReport(fetched);
        } else {
          navigate("/admin/create-event");
        }
      } catch (err) {
        console.error("Error loading report:", err);
        navigate("/admin/create-event");
      } finally {
        setIsLoading(false);
      }
    };

    const loadCapacityTypes = async () => {
      const { data } = await supabase.from("capacity_types").select("*");
      if (data) setCapacityTypes(data as CapacityType[]);
    };

    loadReport();
    loadCapacityTypes();
  }, [reportId, authLoading, navigate]);

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
        <p className="text-muted-foreground">Report not found.</p>
      </div>
    );
  }

  if (report.status !== "draft") {
    return (
      <div className="container max-w-4xl py-12 text-center space-y-4">
        <Badge variant="secondary" className="text-base px-4 py-1">
          {report.status === "confirmed" ? "Confirmed" : "Discarded"}
        </Badge>
        <p className="text-muted-foreground">
          This report can no longer be edited.
        </p>
        {report.linked_event_id && (
          <Button onClick={() => navigate(`/admin/event-dashboard/${report.linked_event_id}`)}>
            View event dashboard
          </Button>
        )}
      </div>
    );
  }

  const updateReport = (updates: Partial<InitialSituationReport>) => {
    setReport((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      situationReportService.updateDraft(prev.id, updates);
      return updated;
    });
  };

  const handleSaveDraft = async () => {
    if (!report) return;
    setIsSaving(true);
    try {
      await situationReportService.updateDraft(report.id, {
        event_name_suggested: report.event_name_suggested,
        event_type: report.event_type,
        summary: report.summary,
        suggested_sectors: report.suggested_sectors,
        suggested_capabilities: report.suggested_capabilities,
      });
      toast({ title: "Draft saved" });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error saving",
        description: error.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = async () => {
    if (!report) return;
    try {
      await situationReportService.discard(report.id);
      toast({ title: "Report discarded" });
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
      const { eventId } = await situationReportService.confirm(report.id);

      toast({
        title: "Coordination activated!",
        description: `Event "${report.event_name_suggested}" created successfully.`,
      });

      navigate(`/admin/event-dashboard/${eventId}`);
    } catch (error: any) {
      console.error("Error confirming report:", error);
      toast({
        variant: "destructive",
        title: "Error confirming",
        description: error.message,
      });
    } finally {
      setIsConfirming(false);
    }
  };

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
        { ...sector, name: `${sector.name} (copy)`, latitude: null, longitude: null, confidence: 1 },
      ],
    });
  };

  const handleAddSector = () => {
    updateReport({
      suggested_sectors: [
        ...report.suggested_sectors,
        {
          name: "New sector",
          description: "",
          latitude: null,
          longitude: null,
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
            Draft
          </Badge>
          <span className="text-sm text-muted-foreground">
            Generated: {format(new Date(report.created_at), "d MMM yyyy, HH:mm")}
          </span>
        </div>
        <h1 className="text-2xl font-bold">Initial Situation Report</h1>
      </div>

      {/* Event Details */}
      <Card className="mb-6 glass">
        <CardHeader>
          <CardTitle className="text-lg">Suggested Event</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Event name
            </label>
            <InlineEditable
              value={report.event_name_suggested || ""}
              onChange={(v) => updateReport({ event_name_suggested: v })}
              placeholder="Enter event name..."
              className="text-xl font-semibold mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Emergency type
            </label>
            <Select
              value={report.event_type || ""}
              onValueChange={(v) => updateReport({ event_type: v })}
            >
              <SelectTrigger className="mt-1 w-full max-w-xs">
                <SelectValue placeholder="Select type..." />
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
              Situation summary
            </label>
            <InlineEditable
              value={report.summary || ""}
              onChange={(v) => updateReport({ summary: v })}
              placeholder="Describe the situation..."
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
              Suggested Operational Sectors
            </CardTitle>
            <Badge variant="secondary">{includedSectorsCount} included</Badge>
          </div>
          <Button size="sm" variant="outline" onClick={handleAddSector}>
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {report.suggested_sectors.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No suggested sectors. Add one manually.
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
              Critical Capabilities (Event Level)
            </CardTitle>
            <Badge variant="secondary">{includedCapabilitiesCount} included</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            These capabilities are required for the entire event. You can assign sector-level priorities later.
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
            <p className="font-medium">This is an AI-generated proposal</p>
            <p className="text-sm text-muted-foreground">
              Review the information before confirming. Activating coordination will create the event, sectors, and needs in the system.
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
              Creating event...
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              Confirm and Activate Coordination
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
          Save Draft
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
              Discard
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Discard report?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. The report will be marked as discarded.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDiscard}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Discard
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

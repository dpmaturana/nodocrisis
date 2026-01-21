import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CapabilityRow } from "./CapabilityRow";
import { FieldStatusReport } from "./FieldStatusReport";
import { CapacityIcon } from "@/components/ui/CapacityIcon";
import { SectorDetailDrawer } from "@/components/sectors/SectorDetailDrawer";
import { useToast } from "@/hooks/use-toast";
import { deploymentService, type SectorDeploymentGroup } from "@/services/deploymentService";
import type { EnrichedSector } from "@/services/sectorService";
import { MapPin, Activity, ChevronRight, Users, CheckCircle } from "@/lib/icons";

interface SectorDeploymentCardProps {
  group: SectorDeploymentGroup;
  actorId: string;
  onRefresh: () => void;
}

const sectorStateConfig = {
  critical: {
    status: "gap-critical" as const,
    label: "Sector crítico",
    microcopy: "Brecha sigue activa según señales disponibles",
  },
  partial: {
    status: "gap-partial" as const,
    label: "Brecha parcial",
    microcopy: "Cobertura insuficiente en algunas capacidades",
  },
  contained: {
    status: "gap-active" as const,
    label: "Sector contenido",
    microcopy: "Situación estabilizada por ahora",
  },
};

const phaseConfig = {
  preparing: {
    status: "deploy-confirmed" as const,
    label: "Preparándose para operar",
  },
  operating: {
    status: "deploy-operating" as const,
    label: "Operando",
  },
  stabilizing: {
    status: "gap-active" as const,
    label: "En monitoreo",
  },
};

export function SectorDeploymentCard({ group, actorId, onRefresh }: SectorDeploymentCardProps) {
  const { toast } = useToast();
  const [isMarkingOperating, setIsMarkingOperating] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const { sector, event, sectorState, sectorContext, deployments, operatingPhase, otherActors } = group;
  const stateConfig = sectorStateConfig[sectorState];
  const phase = phaseConfig[operatingPhase];

  // Build EnrichedSector for the drawer
  const enrichedSector: EnrichedSector = {
    sector,
    event,
    state: sectorState,
    context: sectorContext,
    gaps: [],
    relevantGaps: [],
    bestMatchGaps: [],
    actorsInSector: otherActors,
    recentSignals: [],
  };

  const handleMarkAsOperating = async () => {
    setIsMarkingOperating(true);
    try {
      await deploymentService.markSectorAsOperating(sector.id, actorId);
      toast({
        title: "¡Operación iniciada!",
        description: "Tus capacidades ahora están marcadas como operando.",
      });
      onRefresh();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsMarkingOperating(false);
    }
  };

  const handleFinishOperations = async () => {
    setIsFinishing(true);
    try {
      for (const dep of deployments) {
        if (dep.status === "operating" || dep.status === "confirmed" || dep.status === "interested") {
          await deploymentService.updateStatus(dep.id, "finished");
        }
      }
      toast({
        title: "Operación finalizada",
        description: "Tus despliegues han sido marcados como finalizados.",
      });
      onRefresh();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsFinishing(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-lg">{sector.canonical_name}</h3>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Activity className="w-4 h-4" />
              <span>{event.name}</span>
              {event.location && (
                <>
                  <span>·</span>
                  <span>{event.location}</span>
                </>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" asChild>
            <Link to={`/events/${event.id}`}>
              <ChevronRight className="w-5 h-5" />
            </Link>
          </Button>
        </div>

        {/* Phase/State indicator */}
        <div className="flex items-center gap-2 mt-2">
          {operatingPhase === "operating" ? (
            <>
              <StatusBadge status={stateConfig.status} label={stateConfig.label} size="sm" />
              <span className="text-xs text-muted-foreground">{stateConfig.microcopy}</span>
            </>
          ) : operatingPhase === "stabilizing" ? (
            <>
              <StatusBadge status="gap-active" label="Sector contenido" size="sm" />
              <span className="text-xs text-muted-foreground">En monitoreo</span>
            </>
          ) : (
            <StatusBadge status={phase.status} label={phase.label} size="sm" />
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Phase-specific content */}
        {operatingPhase === "preparing" && (
          <PreparingPhaseContent
            sectorContext={sectorContext}
            otherActors={otherActors}
            deployments={deployments}
            onMarkOperating={handleMarkAsOperating}
            isLoading={isMarkingOperating}
            onOpenSectorContext={() => setIsDrawerOpen(true)}
          />
        )}

        {operatingPhase === "operating" && (
          <OperatingPhaseContent
            deployments={deployments}
            group={group}
            actorId={actorId}
            onRefresh={onRefresh}
            onFinish={handleFinishOperations}
            isFinishing={isFinishing}
          />
        )}

        {operatingPhase === "stabilizing" && (
          <StabilizingPhaseContent
            deployments={deployments}
            onFinish={handleFinishOperations}
            isFinishing={isFinishing}
          />
        )}
      </CardContent>

      {/* Sector Detail Drawer - hide enroll since user is already deployed */}
      <SectorDetailDrawer
        sector={enrichedSector}
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        onEnroll={() => {}}
        hideEnrollButton
      />
    </Card>
  );
}

// ============ Phase Content Components ============

interface PreparingPhaseContentProps {
  sectorContext: SectorDeploymentGroup["sectorContext"];
  otherActors: SectorDeploymentGroup["otherActors"];
  deployments: SectorDeploymentGroup["deployments"];
  onMarkOperating: () => void;
  isLoading: boolean;
  onOpenSectorContext: () => void;
}

function PreparingPhaseContent({
  sectorContext,
  otherActors,
  deployments,
  onMarkOperating,
  isLoading,
  onOpenSectorContext,
}: PreparingPhaseContentProps) {
  return (
    <>
      {/* Operational Context */}
      {sectorContext.keyPoints.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Contexto operativo</h4>
          <ul className="space-y-1">
            {sectorContext.keyPoints.slice(0, 3).map((point, idx) => (
              <li key={idx} className="text-sm flex items-start gap-2">
                <span className="text-primary">•</span>
                {point}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Other Actors */}
      {otherActors.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Users className="w-4 h-4" />
            Otros actores en el sector
          </h4>
          <div className="space-y-1">
            {otherActors.slice(0, 3).map((actor) => (
              <div key={actor.id} className="flex items-center gap-2 text-sm">
                <StatusBadge
                  status={actor.status === "operating" ? "deploy-operating" : "deploy-confirmed"}
                  size="sm"
                  showIcon={false}
                />
                <span className="font-medium">{actor.name}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">{actor.capacity}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* My Capabilities */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-muted-foreground">Tus capacidades</h4>
        <div className="flex flex-wrap gap-2">
          {deployments.map((dep) => (
            <div
              key={dep.id}
              className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg text-sm"
            >
              <CapacityIcon
                name={dep.capacity_type?.name || ""}
                icon={dep.capacity_type?.icon}
                size="sm"
              />
              <span>{dep.capacity_type?.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row gap-2 pt-2">
        <Button
          onClick={onMarkOperating}
          disabled={isLoading}
          className="flex-1 gap-2"
        >
          👉 Estamos operando
        </Button>
        <Button 
          variant="outline" 
          className="gap-2"
          onClick={onOpenSectorContext}
        >
          Ver contexto del sector
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </>
  );
}

interface OperatingPhaseContentProps {
  deployments: SectorDeploymentGroup["deployments"];
  group: SectorDeploymentGroup;
  actorId: string;
  onRefresh: () => void;
  onFinish: () => void;
  isFinishing: boolean;
}

function OperatingPhaseContent({
  deployments,
  group,
  actorId,
  onRefresh,
  onFinish,
  isFinishing,
}: OperatingPhaseContentProps) {
  return (
    <>
      {/* Capabilities List */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-muted-foreground">
          Tus capacidades en este sector
        </h4>
        <div className="space-y-2">
          {deployments.map((dep) => (
            <CapabilityRow key={dep.id} deployment={dep} />
          ))}
        </div>
      </div>

      {/* Field Status Report - Expanded by default */}
      <FieldStatusReport
        group={group}
        actorId={actorId}
        onReportSent={onRefresh}
      />

      {/* Finish option */}
      <div className="pt-2 border-t">
        <Button
          variant="ghost"
          size="sm"
          onClick={onFinish}
          disabled={isFinishing}
          className="text-muted-foreground hover:text-foreground"
        >
          Finalizar operación
        </Button>
      </div>
    </>
  );
}

interface StabilizingPhaseContentProps {
  deployments: SectorDeploymentGroup["deployments"];
  onFinish: () => void;
  isFinishing: boolean;
}

function StabilizingPhaseContent({
  deployments,
  onFinish,
  isFinishing,
}: StabilizingPhaseContentProps) {
  return (
    <>
      {/* Success message */}
      <div className="flex items-start gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
        <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-green-700 dark:text-green-400">
            Tu apoyo ha contribuido a estabilizar la situación
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            El sector está contenido. Puedes mantener el monitoreo o finalizar tu operación.
          </p>
        </div>
      </div>

      {/* Capabilities summary */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-muted-foreground">Tus capacidades</h4>
        <div className="flex flex-wrap gap-2">
          {deployments.map((dep) => (
            <div
              key={dep.id}
              className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg text-sm"
            >
              <CapacityIcon
                name={dep.capacity_type?.name || ""}
                icon={dep.capacity_type?.icon}
                size="sm"
              />
              <span>{dep.capacity_type?.name}</span>
              <StatusBadge status="deploy-operating" label="Operando" size="sm" />
            </div>
          ))}
        </div>
      </div>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row gap-2 pt-2">
        <Button variant="outline" className="flex-1">
          Mantener en monitoreo
        </Button>
        <Button
          variant="secondary"
          onClick={onFinish}
          disabled={isFinishing}
          className="flex-1"
        >
          Finalizar operación
        </Button>
      </div>
    </>
  );
}

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CapabilityRow } from "./CapabilityRow";
import { FieldStatusReport } from "./FieldStatusReport";
import { CapacityIcon } from "@/components/ui/CapacityIcon";
import { SectorDetailDrawer } from "@/components/sectors/SectorDetailDrawer";
import { EnrollmentModal } from "@/components/sectors/EnrollmentModal";
import { useToast } from "@/hooks/use-toast";
import { deploymentService, type SectorDeploymentGroup } from "@/services/deploymentService";
import { sectorService, type EnrichedSector } from "@/services/sectorService";
import { capabilityService } from "@/services";
import type { Signal, ActorCapability } from "@/types/database";
import { MapPin, Activity, ChevronRight, Users, CheckCircle, Plus } from "@/lib/icons";

interface SectorDeploymentCardProps {
  group: SectorDeploymentGroup;
  actorId: string;
  onRefresh: () => void;
}

const sectorStateConfig = {
  critical: {
    status: "gap-critical" as const,
    label: "Critical sector",
    microcopy: "Gap remains active based on available signals",
  },
  partial: {
    status: "gap-partial" as const,
    label: "Partial gap",
    microcopy: "Insufficient coverage across some capabilities",
  },
  contained: {
    status: "gap-active" as const,
    label: "Contained sector",
    microcopy: "Situation stabilized for now",
  },
};

const phaseConfig = {
  preparing: {
    status: "deploy-confirmed" as const,
    label: "Preparing to operate",
  },
  operating: {
    status: "deploy-operating" as const,
    label: "Operating",
  },
  stabilizing: {
    status: "gap-active" as const,
    label: "Under monitoring",
  },
};

export function SectorDeploymentCard({ group, actorId, onRefresh }: SectorDeploymentCardProps) {
  const { toast } = useToast();
  const [isMarkingOperating, setIsMarkingOperating] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isAddCapabilityOpen, setIsAddCapabilityOpen] = useState(false);
  const [enrichedSector, setEnrichedSector] = useState<EnrichedSector | null>(null);
  const [userCapabilities, setUserCapabilities] = useState<ActorCapability[]>([]);

  const { sector, event, sectorState, sectorContext, deployments, operatingPhase, otherActors } = group;
  const stateConfig = sectorStateConfig[sectorState];
  const phase = phaseConfig[operatingPhase];

  // Fetch actor capabilities on mount
  useEffect(() => {
    capabilityService.getByActor(actorId).then(setUserCapabilities).catch((err) => {
      console.error("Failed to fetch actor capabilities:", err);
    });
  }, [actorId]);

  // Fetch real enriched sector data when drawer or add-capability modal is opened
  useEffect(() => {
    if (isDrawerOpen || isAddCapabilityOpen) {
      sectorService.getEnrichedSectors(actorId).then((sectors) => {
        const found = sectors.find((s) => s.sector.id === sector.id);
        if (found) {
          setEnrichedSector(found);
        } else {
          // Sector has no gaps visible to this actor — show minimal info
          setEnrichedSector({
            sector,
            event,
            state: sectorState,
            context: sectorContext,
            gaps: [],
            relevantGaps: [],
            bestMatchGaps: [],
            actorsInSector: otherActors,
            recentSignals: [],
          });
        }
      });
    } else {
      setEnrichedSector(null);
    }
  }, [isDrawerOpen, isAddCapabilityOpen, actorId, sector, event, sectorState, sectorContext, otherActors]);

  // Filter out capabilities the user is already enrolled with in this sector
  const alreadyEnrolledTypeIds = new Set(
    deployments
      .filter((d) => d.status !== "finished" && d.status !== "suspended")
      .map((d) => d.capacity_type_id)
  );
  const availableCapabilities = userCapabilities.filter(
    (cap) => !alreadyEnrolledTypeIds.has(cap.capacity_type_id)
  );

  // Build EnrichedSector for the drawer
  const drawerSector: EnrichedSector = enrichedSector ?? {
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
            onAddCapability={() => setIsAddCapabilityOpen(true)}
            hasAvailableCapabilities={availableCapabilities.length > 0}
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
            onAddCapability={() => setIsAddCapabilityOpen(true)}
            hasAvailableCapabilities={availableCapabilities.length > 0}
          />
        )}

        {operatingPhase === "stabilizing" && (
          <StabilizingPhaseContent
            deployments={deployments}
            onFinish={handleFinishOperations}
            isFinishing={isFinishing}
            onAddCapability={() => setIsAddCapabilityOpen(true)}
            hasAvailableCapabilities={availableCapabilities.length > 0}
          />
        )}
      </CardContent>

      {/* Sector Detail Drawer - hide enroll since user is already deployed */}
      <SectorDetailDrawer
        sector={drawerSector}
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        onEnroll={() => {}}
        hideEnrollButton
      />

      {/* Add Capability Modal */}
      <EnrollmentModal
        sector={drawerSector}
        userCapabilities={availableCapabilities}
        userId={actorId}
        open={isAddCapabilityOpen}
        onOpenChange={setIsAddCapabilityOpen}
        onSuccess={() => {
          setIsAddCapabilityOpen(false);
          onRefresh();
        }}
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
  onAddCapability: () => void;
  hasAvailableCapabilities: boolean;
}

function PreparingPhaseContent({
  sectorContext,
  otherActors,
  deployments,
  onMarkOperating,
  isLoading,
  onOpenSectorContext,
  onAddCapability,
  hasAvailableCapabilities,
}: PreparingPhaseContentProps) {
  return (
    <>
      {/* Operational Context */}
      {sectorContext.keyPoints.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Operational Context</h4>
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
            Other actors in the sector
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
            <div key={dep.id} className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg text-sm">
              <CapacityIcon name={dep.capacity_type?.name || ""} icon={dep.capacity_type?.icon} size="sm" />
              <span>{dep.capacity_type?.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row gap-2 pt-2">
        <Button onClick={onMarkOperating} disabled={isLoading} className="flex-1 gap-2">
          👉 We are operating
        </Button>
        <Button variant="outline" className="gap-2" onClick={onOpenSectorContext}>
          View sector overview
          <ChevronRight className="w-4 h-4" />
        </Button>
        {hasAvailableCapabilities && (
          <Button variant="outline" size="sm" className="gap-2" onClick={onAddCapability}>
            <Plus className="w-4 h-4" />
            Add capability
          </Button>
        )}
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
  onAddCapability: () => void;
  hasAvailableCapabilities: boolean;
}

function OperatingPhaseContent({
  deployments,
  group,
  actorId,
  onRefresh,
  onFinish,
  isFinishing,
  onAddCapability,
  hasAvailableCapabilities,
}: OperatingPhaseContentProps) {
  return (
    <>
      {/* Capabilities List */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-muted-foreground">Your capabilities in this sector</h4>
        <div className="space-y-2">
          {deployments.map((dep) => (
            <CapabilityRow key={dep.id} deployment={dep} />
          ))}
        </div>
      </div>

      {/* Field Status Report - Expanded by default */}
      <FieldStatusReport group={group} actorId={actorId} onReportSent={onRefresh} />

      {/* Finish option */}
      <div className="pt-2 border-t">
        <Button variant="outline" onClick={onFinish} disabled={isFinishing} className="w-full gap-2">
          <CheckCircle className="w-4 h-4" />
          Complete operation
        </Button>
        {hasAvailableCapabilities && (
          <Button variant="outline" size="sm" className="gap-2 mt-2" onClick={onAddCapability}>
            <Plus className="w-4 h-4" />
            Add capability
          </Button>
        )}
      </div>
    </>
  );
}

interface StabilizingPhaseContentProps {
  deployments: SectorDeploymentGroup["deployments"];
  onFinish: () => void;
  isFinishing: boolean;
  onAddCapability: () => void;
  hasAvailableCapabilities: boolean;
}

function StabilizingPhaseContent({ deployments, onFinish, isFinishing, onAddCapability, hasAvailableCapabilities }: StabilizingPhaseContentProps) {
  return (
    <>
      {/* Success message */}
      <div className="flex items-start gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
        <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-green-700 dark:text-green-400">
            Your support contributed to stabilize the situation
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Sector is contained. You can continue monitoring or end your operation.
          </p>
        </div>
      </div>

      {/* Capabilities summary */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-muted-foreground">Tus capacidades</h4>
        <div className="flex flex-wrap gap-2">
          {deployments.map((dep) => (
            <div key={dep.id} className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg text-sm">
              <CapacityIcon name={dep.capacity_type?.name || ""} icon={dep.capacity_type?.icon} size="sm" />
              <span>{dep.capacity_type?.name}</span>
              <StatusBadge status="deploy-operating" label="Operando" size="sm" />
            </div>
          ))}
        </div>
      </div>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row gap-2 pt-2">
        <Button variant="outline" className="flex-1">
          Continue monitoring
        </Button>
        <Button variant="secondary" onClick={onFinish} disabled={isFinishing} className="flex-1">
          End operation
        </Button>
        {hasAvailableCapabilities && (
          <Button variant="outline" size="sm" className="gap-2" onClick={onAddCapability}>
            <Plus className="w-4 h-4" />
            Add capability
          </Button>
        )}
      </div>
    </>
  );
}

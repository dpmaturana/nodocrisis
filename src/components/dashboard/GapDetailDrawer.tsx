import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { AlertCircle, AlertTriangle, MessageSquare, Radio, FileText, Users, ChevronRight } from "lucide-react";
import { gapService, type GapWithDetails } from "@/services";
import { getDeploymentStateConfig } from "@/lib/stateTransitions";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Signal, Deployment, SignalType } from "@/types/database";

interface GapDetailDrawerProps {
  gapId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onViewActors?: () => void;
}

const signalTypeConfig: Record<SignalType, { icon: typeof MessageSquare; label: string; priority: number }> = {
  context: { icon: FileText, label: "Contexto inicial", priority: 1 },
  field_report: { icon: Radio, label: "Reporte de terreno", priority: 2 },
  actor_report: { icon: Users, label: "Reporte de actor", priority: 3 },
  sms: { icon: MessageSquare, label: "SMS ciudadano", priority: 4 },
  official: { icon: FileText, label: "Fuente oficial", priority: 5 },
  news: { icon: FileText, label: "Noticia", priority: 6 },
  social: { icon: MessageSquare, label: "Red social", priority: 7 },
};

export function GapDetailDrawer({ 
  gapId, 
  open, 
  onOpenChange,
  onViewActors,
}: GapDetailDrawerProps) {
  const [gap, setGap] = useState<GapWithDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (gapId && open) {
      setIsLoading(true);
      gapService.getGapById(gapId)
        .then(setGap)
        .finally(() => setIsLoading(false));
    }
  }, [gapId, open]);

  const isCritical = gap?.state === 'critical';
  const Icon = isCritical ? AlertCircle : AlertTriangle;

  // Group signals by type
  const signalsByType = gap?.signals?.reduce((acc, signal) => {
    const type = signal.signal_type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(signal);
    return acc;
  }, {} as Record<SignalType, Signal[]>) || {};

  // Sort types by priority
  const sortedTypes = Object.keys(signalsByType).sort((a, b) => 
    signalTypeConfig[a as SignalType].priority - signalTypeConfig[b as SignalType].priority
  ) as SignalType[];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : gap ? (
          <>
            <SheetHeader className="space-y-4">
              {/* State badge */}
              <div className={cn(
                "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium w-fit",
                isCritical ? "bg-gap-critical/20 text-gap-critical" : "bg-warning/20 text-warning"
              )}>
                <Icon className="w-4 h-4" />
                {isCritical ? "Brecha Crítica" : "Brecha Parcial"}
              </div>

              <div>
                <SheetTitle className="text-xl">
                  {gap.capacity_type?.name}
                </SheetTitle>
                <SheetDescription className="text-base">
                  {gap.sector?.canonical_name}
                </SheetDescription>
              </div>
            </SheetHeader>

            <div className="mt-6 space-y-6">
              {/* Signals section */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Causas de la brecha
                </h3>
                
                <Accordion type="multiple" className="space-y-2">
                  {sortedTypes.map((type) => {
                    const config = signalTypeConfig[type];
                    const signals = signalsByType[type];
                    const TypeIcon = config.icon;

                    return (
                      <AccordionItem 
                        key={type} 
                        value={type}
                        className="border rounded-lg px-4"
                      >
                        <AccordionTrigger className="hover:no-underline py-3">
                          <div className="flex items-center gap-3">
                            <TypeIcon className="w-4 h-4 text-muted-foreground" />
                            <span>{config.label}</span>
                            <Badge variant="secondary" className="ml-2">
                              {signals.length}
                            </Badge>
                            {type === 'field_report' && (
                              <Badge variant="outline" className="text-xs">
                                Mayor peso
                              </Badge>
                            )}
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-4">
                          <div className="space-y-3">
                            {signals.map((signal) => (
                              <div 
                                key={signal.id}
                                className="p-3 rounded-lg bg-muted/50 text-sm"
                              >
                                <p className="text-foreground">{signal.content}</p>
                                <p className="text-xs text-muted-foreground mt-2">
                                  {signal.source} · Hace {formatDistanceToNow(new Date(signal.created_at), { locale: es })}
                                </p>
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </div>

              {/* Coverage section */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Cobertura actual
                </h3>
                
                {gap.coverage && gap.coverage.length > 0 ? (
                  <div className="space-y-2">
                    {gap.coverage.map((deployment) => {
                      const stateConfig = getDeploymentStateConfig(deployment.status);
                      const StateIcon = stateConfig.icon;
                      
                      return (
                        <div 
                          key={deployment.id}
                          className="flex items-center justify-between p-3 rounded-lg border"
                        >
                          <span className="text-sm">
                            Actor #{deployment.actor_id.slice(-4)}
                          </span>
                          <div className={cn(
                            "flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full",
                            stateConfig.bg,
                            stateConfig.text
                          )}>
                            <StateIcon className="w-3 h-3" />
                            {stateConfig.label}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    Sin actores asignados aún
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="pt-4 border-t space-y-3">
                <Button 
                  className="w-full" 
                  onClick={() => {
                    onOpenChange(false);
                    onViewActors?.();
                  }}
                >
                  <Users className="w-4 h-4 mr-2" />
                  Ver actores disponibles
                </Button>
                <Button variant="outline" className="w-full" disabled>
                  Actualizar contexto
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">No se encontró la brecha</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

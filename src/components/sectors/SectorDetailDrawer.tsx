import { formatDistanceToNow } from "date-fns";
import { MapPin, Users, AlertTriangle, FileText, MessageSquare, ChevronDown, CheckCircle2, Clock3 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CapacityIcon } from "@/components/ui/CapacityIcon";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";
import type { EnrichedSector } from "@/services/sectorService";
import { NEED_STATUS_PRESENTATION } from "@/lib/needStatus";
import type { NeedLevel } from "@/types/database";
import type { NeedStatus } from "@/lib/needStatus";

function needLevelToStatus(level: NeedLevel): NeedStatus {
  if (level === "critical") return "RED";
  if (level === "high") return "ORANGE";
  if (level === "medium") return "YELLOW";
  return "WHITE";
}

function stateToNeedStatus(state: EnrichedSector["state"]): NeedStatus {
  if (state === "critical") return "RED";
  if (state === "partial") return "ORANGE";
  if (state === "contained") return "GREEN";
  return "WHITE";
}

const DEFAULT_OPERATIONAL_SUMMARY = "Sector sin evaluación detallada.";

interface SectorDetailDrawerProps {
  sector: EnrichedSector | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEnroll: () => void;
  hideEnrollButton?: boolean;
}

export function SectorDetailDrawer({ 
  sector, 
  open, 
  onOpenChange, 
  onEnroll,
  hideEnrollButton = false,
}: SectorDetailDrawerProps) {
  const [otherGapsOpen, setOtherGapsOpen] = useState(false);
  const [resolvedGapsOpen, setResolvedGapsOpen] = useState(false);
  
  if (!sector) return null;

  const { 
    sector: sectorData, 
    event, 
    state, 
    context, 
    relevantGaps, 
    gaps: allGaps,
    actorsInSector,
    recentSignals,
    resolvedGaps,
  } = sector;

  const otherGaps = allGaps.filter(
    g => !relevantGaps.some(rg => rg.capacityType.id === g.capacityType.id)
  );

  const sectorStatus = NEED_STATUS_PRESENTATION[stateToNeedStatus(state)];

  const hasOperationalSummary =
    !!context.operationalSummary &&
    context.operationalSummary !== DEFAULT_OPERATIONAL_SUMMARY;

  const hasExtendedContext =
    !!context.extendedContext &&
    context.extendedContext !== "No hay contexto disponible para este sector.";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col m-2">
        <SheetHeader className="p-6 pb-4 border-b bg-muted/30">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-xl">{sectorData.canonical_name}</SheetTitle>
              <SheetDescription>{event.name}</SheetDescription>
              <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-medium ${sectorStatus.bg} ${sectorStatus.text}`}>
                {sectorStatus.label}
              </span>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            {/* Operational Summary — hidden when default/empty */}
            {hasOperationalSummary && (
              <>
                <section>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Operational Summary
                  </h3>
                  <p className="text-sm italic text-foreground/80 bg-muted/50 p-3 rounded-lg">
                    "{context.operationalSummary}"
                  </p>
                </section>
                <Separator />
              </>
            )}

            {/* Context Details — hidden when default/empty */}
            {hasExtendedContext && (
              <>
                <section>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                    Sector Context
                  </h3>
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground mt-2">
                      {context.extendedContext}
                    </p>
                  </div>
                </section>
                <Separator />
              </>
            )}

            {/* Recent Signals — moved before Active Gaps */}
            {recentSignals.length > 0 && (
              <>
                <section>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                    Eventos recientes
                  </h3>
                  <div className="space-y-2">
                    {recentSignals.slice(0, 3).map((signal) => (
                      <div 
                        key={signal.id}
                        className="flex items-start gap-2 text-sm overflow-hidden"
                      >
                        {signal.signal_type === "field_report" ? (
                          <FileText className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        ) : (
                          <MessageSquare className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm break-words line-clamp-2">{signal.content}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(signal.created_at), { 
                              addSuffix: true
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
                <Separator />
              </>
            )}

            {/* Gaps - Relevant */}
            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Active Gaps
              </h3>
              
              {relevantGaps.length > 0 && (
                <div className="space-y-2 mb-4">
                  {relevantGaps.map((gap) => {
                    const needStatus = needLevelToStatus(gap.maxLevel);
                    const presentation = NEED_STATUS_PRESENTATION[needStatus];
                    const Icon = presentation.icon;
                    return (
                      <div 
                        key={gap.capacityType.id}
                        className={`p-3 rounded-lg border ${presentation.bg} ${presentation.border}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CapacityIcon 
                              name={gap.capacityType.name} 
                              icon={gap.capacityType.icon} 
                              size="sm" 
                            />
                            <span className={`font-medium text-sm ${presentation.text}`}>{gap.capacityType.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs ${presentation.text}`}>
                              Level: {gap.maxLevel}
                            </span>
                            <Icon className={`w-4 h-4 ${presentation.text}`} />
                          </div>
                        </div>
                        {gap.coveringActors && gap.coveringActors.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {gap.coveringActors.map((actor, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-background/60 border border-border text-muted-foreground"
                              >
                                <Users className="w-3 h-3" /> {actor.name} · {actor.status}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Other Gaps - Collapsible */}
              {otherGaps.length > 0 && (
                <Collapsible open={otherGapsOpen} onOpenChange={setOtherGapsOpen}>
                  <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-full">
                    <ChevronDown className={`w-4 h-4 transition-transform ${otherGapsOpen ? "rotate-180" : ""}`} />
                    Other gaps ({otherGaps.length})
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 space-y-2">
                    {otherGaps.map((gap) => {
                      const needStatus = needLevelToStatus(gap.maxLevel);
                      const presentation = NEED_STATUS_PRESENTATION[needStatus];
                      const Icon = presentation.icon;
                      return (
                        <div 
                          key={gap.capacityType.id}
                          className={`p-2 rounded border ${presentation.bg} ${presentation.border}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <CapacityIcon 
                                name={gap.capacityType.name} 
                                icon={gap.capacityType.icon} 
                                size="sm" 
                              />
                              <span className={`text-sm ${presentation.text}`}>{gap.capacityType.name}</span>
                            </div>
                            <Icon className={`w-4 h-4 ${presentation.text}`} />
                          </div>
                          {gap.coveringActors && gap.coveringActors.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {gap.coveringActors.map((actor, i) => (
                                <span
                                  key={i}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-background/60 border border-border text-muted-foreground"
                                >
                                  <Users className="w-3 h-3" /> {actor.name} · {actor.status}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </CollapsibleContent>
                </Collapsible>
              )}
            </section>

            {/* Actors in Sector */}
            {actorsInSector.length > 0 && (
              <>
                <Separator />
                <section>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                    Actors Supporting in Sector
                  </h3>
                  
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30 mb-3">
                    <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                    <p className="text-xs text-foreground">
                      The presence or number of actors does not imply the need is contained.
                    </p>
                  </div>

                  <div className="space-y-2">
                    {actorsInSector.map((actor) => {
                      const isOperating = actor.status === "operating";
                      const StatusIcon = isOperating ? CheckCircle2 : Clock3;
                      const statusColor = isOperating ? "text-coverage" : "text-warning";
                      const statusLabel = isOperating ? "Operating" : "Confirmed";
                      return (
                        <div 
                          key={actor.id}
                          className="p-3 rounded-lg border bg-card"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <StatusIcon className={`w-4 h-4 ${statusColor}`} />
                            <span className="font-medium text-sm">{actor.name}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {actor.capacity} · {statusLabel}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </>
            )}

            {/* Resolved Gaps — collapsible, collapsed by default */}
            {resolvedGaps && resolvedGaps.length > 0 && (
              <>
                <Separator />
                <section>
                  <Collapsible open={resolvedGapsOpen} onOpenChange={setResolvedGapsOpen}>
                    <CollapsibleTrigger className="flex items-center gap-2 text-sm text-coverage hover:text-coverage/80 w-full font-semibold">
                      <ChevronDown className={`w-4 h-4 transition-transform ${resolvedGapsOpen ? "rotate-180" : ""}`} />
                      Brechas resueltas ({resolvedGaps.length})
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-3 space-y-2">
                      {resolvedGaps.map((gap) => (
                        <div
                          key={gap.capacityType.id}
                          className="p-2 rounded border bg-coverage/10 border-coverage/30"
                        >
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-coverage shrink-0" />
                            <CapacityIcon
                              name={gap.capacityType.name}
                              icon={gap.capacityType.icon}
                              size="sm"
                            />
                            <span className="text-sm text-coverage">{gap.capacityType.name}</span>
                          </div>
                          {gap.coveringActors && gap.coveringActors.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {gap.coveringActors.map((actor, i) => (
                                <span
                                  key={i}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-background/60 border border-coverage/30 text-coverage"
                                >
                                  <Users className="w-3 h-3" /> {actor.name} · {actor.status}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                </section>
              </>
            )}
          </div>
        </ScrollArea>

        {/* Sticky CTA - Only show if not already enrolled */}
        {!hideEnrollButton && (
          <div className="p-4 border-t bg-background">
            <Button className="w-full" size="lg" onClick={onEnroll}>
              <Users className="w-4 h-4 mr-2" />
              Enroll in this sector
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

import { formatDistanceToNow } from "date-fns";
import { MapPin, Users, AlertTriangle, FileText, MessageSquare, Info, ChevronDown } from "lucide-react";
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
  } = sector;

  const otherGaps = allGaps.filter(
    g => !relevantGaps.some(rg => rg.capacityType.id === g.capacityType.id)
  );

  const stateConfig = {
    critical: { label: "Critical sector", icon: "🔴", className: "text-gap-critical" },
    partial: { label: "Partial sector", icon: "🟠", className: "text-warning" },
    contained: { label: "Contained sector", icon: "🟢", className: "text-coverage" },
  };

  const config = stateConfig[state];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="p-6 pb-4 border-b bg-muted/30">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-xl">{sectorData.canonical_name}</SheetTitle>
              <SheetDescription>{event.name}</SheetDescription>
              <Badge variant="outline" className={`mt-2 ${config.className}`}>
                {config.icon} {config.label}
              </Badge>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            {/* Operational Summary */}
            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Operational Summary
              </h3>
              <p className="text-sm italic text-foreground/80 bg-muted/50 p-3 rounded-lg">
                "{context.operationalSummary}"
              </p>
            </section>

            <Separator />

            {/* Context Details */}
            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Sector Context
              </h3>
              <div className="space-y-3">
                {context.accessInfo && (
                  <div className="flex items-start gap-2 text-sm">
                    <span className="font-medium text-muted-foreground w-20 shrink-0">Access:</span>
                    <span>{context.accessInfo}</span>
                  </div>
                )}
                {context.isolationLevel && context.isolationLevel !== "none" && (
                  <div className="flex items-start gap-2 text-sm">
                    <span className="font-medium text-muted-foreground w-20 shrink-0">Isolation:</span>
                    <span className={context.isolationLevel === "total" ? "text-gap-critical font-medium" : ""}>
                      {context.isolationLevel === "partial" ? "Partial" : "Total"}
                    </span>
                  </div>
                )}
                <p className="text-sm text-muted-foreground mt-2">
                  {context.extendedContext}
                </p>
              </div>
            </section>

            <Separator />

            {/* Gaps - Relevant */}
            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Active Gaps
              </h3>
              
              {relevantGaps.length > 0 && (
                <div className="space-y-2 mb-4">
                  <p className="text-xs text-muted-foreground">
                    Compatible with your capabilities ({relevantGaps.length})
                  </p>
                  {relevantGaps.map((gap) => (
                    <div 
                      key={gap.capacityType.id}
                      className={`p-3 rounded-lg border flex items-center justify-between ${
                        gap.isCritical 
                          ? "border-gap-critical/50 bg-gap-critical/5" 
                          : "border-warning/50 bg-warning/5"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <CapacityIcon 
                          name={gap.capacityType.name} 
                          icon={gap.capacityType.icon} 
                          size="sm" 
                        />
                        <span className="font-medium text-sm">{gap.capacityType.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          Demand: {gap.totalDemand >= 3 ? "High" : gap.totalDemand >= 2 ? "Medium" : "Low"}
                        </span>
                        <span>{gap.isCritical ? "🔴" : "🟠"}</span>
                      </div>
                    </div>
                  ))}
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
                    {otherGaps.map((gap) => (
                      <div 
                        key={gap.capacityType.id}
                        className="p-2 rounded border border-border/50 bg-muted/30 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <CapacityIcon 
                            name={gap.capacityType.name} 
                            icon={gap.capacityType.icon} 
                            size="sm" 
                          />
                          <span className="text-sm">{gap.capacityType.name}</span>
                        </div>
                        <span>{gap.isCritical ? "🔴" : "🟠"}</span>
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              )}
            </section>

            <Separator />

            {/* Actors in Sector */}
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

              {actorsInSector.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  No confirmed or operating actors in this sector.
                </p>
              ) : (
                <div className="space-y-2">
                  {actorsInSector.map((actor) => (
                    <div 
                      key={actor.id}
                      className="p-3 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={actor.status === "operating" ? "text-coverage" : "text-warning"}>
                          {actor.status === "operating" ? "🟢" : "🟨"}
                        </span>
                        <span className="font-medium text-sm">{actor.name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {actor.capacity} · 
                        {actor.status === "operating" ? " Operating" : " Confirmed"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Estimated Magnitude */}
            {(sector.population_affected || context.estimatedAffected) && (
              <>
                <Separator />
                <section>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Estimated Magnitude
                  </h3>
                  <div className="flex items-center gap-2 text-sm">
                    <Info className="w-4 h-4 text-muted-foreground" />
                    <span>
                      People affected: {sector.population_affected?.toLocaleString() ?? context.estimatedAffected}
                      {sector.population_affected ? "" : " (estimated)"}
                    </span>
                  </div>
                </section>
              </>
            )}

            {/* Recent Signals */}
            {recentSignals.length > 0 && (
              <>
                <Separator />
                <section>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                    Recent Signals
                  </h3>
                  <div className="space-y-2">
                    {recentSignals.slice(0, 3).map((signal) => (
                      <div 
                        key={signal.id}
                        className="flex items-start gap-2 text-sm"
                      >
                        {signal.signal_type === "field_report" ? (
                          <FileText className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        ) : (
                          <MessageSquare className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{signal.content}</p>
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

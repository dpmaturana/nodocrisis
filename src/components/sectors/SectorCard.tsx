import { MapPin, ArrowRight, Users, AlertCircle, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CapacityIcon } from "@/components/ui/CapacityIcon";
import { cn } from "@/lib/utils";
import type { EnrichedSector } from "@/services/sectorService";

interface SectorCardProps {
  sector: EnrichedSector;
  onViewDetails: () => void;
  onEnroll: () => void;
}

function getCoverageLabel(gap: EnrichedSector["gaps"][0]): string {
  if (gap.coverage === 0) return "Ninguna";
  if (gap.coverage < gap.totalDemand / 2) return "Insuficiente";
  return "Parcial";
}

const gapStateConfig = {
  critical: {
    label: "Crítica",
    bgClass: "bg-gap-critical/20",
    textClass: "text-gap-critical",
    Icon: AlertCircle,
  },
  partial: {
    label: "Parcial",
    bgClass: "bg-warning/20",
    textClass: "text-warning",
    Icon: AlertTriangle,
  },
};

export function SectorCard({ sector, onViewDetails, onEnroll }: SectorCardProps) {
  const { sector: sectorData, event, state, context, bestMatchGaps } = sector;

  const stateConfig = {
    critical: {
      label: "Sector crítico",
      bgClass: "bg-gap-critical/10",
      borderClass: "border-l-4 border-l-gap-critical",
      badgeVariant: "destructive" as const,
      icon: "🔴",
    },
    partial: {
      label: "Sector parcial",
      bgClass: "bg-warning/10",
      borderClass: "border-l-4 border-l-warning",
      badgeVariant: "secondary" as const,
      icon: "🟠",
    },
    contained: {
      label: "Sector contenido",
      bgClass: "bg-coverage/10",
      borderClass: "border-l-4 border-l-coverage",
      badgeVariant: "outline" as const,
      icon: "🟢",
    },
  };

  const config = stateConfig[state];

  return (
    <Card
      className={`${config.borderClass} ${config.bgClass} hover:shadow-md transition-shadow cursor-pointer`}
      onClick={onViewDetails}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-background/80 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">{sectorData.canonical_name}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {event.name} · {event.location}
              </p>
            </div>
          </div>
          <Badge variant={config.badgeVariant} className="shrink-0">
            {config.icon} {config.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Context Key Points */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Contexto clave</h4>
          <ul className="space-y-1">
            {context.keyPoints.slice(0, 3).map((point, idx) => (
              <li key={idx} className="flex items-center gap-2 text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-foreground/60" />
                {point}
              </li>
            ))}
          </ul>
        </div>

        {/* Best Match Gaps */}
        {bestMatchGaps.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Capacidades que puedes aportar
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {bestMatchGaps.slice(0, 2).map((gap) => {
                const gapState = gap.isCritical ? "critical" : "partial";
                const gapConfig = gapStateConfig[gapState];
                const IconComponent = gapConfig.Icon;
                return (
                  <div
                    key={gap.capacityType.id}
                    className={cn(
                      "p-3 rounded-lg border",
                      gap.isCritical ? "border-gap-critical/50 bg-gap-critical/5" : "border-warning/50 bg-warning/5"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <CapacityIcon name={gap.capacityType.name} icon={gap.capacityType.icon} size="sm" />
                      <span className="font-medium text-sm">{gap.capacityType.name}</span>
                      <span className={cn(
                        "ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                        gapConfig.bgClass,
                        gapConfig.textClass
                      )}>
                        <IconComponent className="w-3 h-3" />
                        {gapConfig.label}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <span className="text-foreground">Cobertura:</span> {getCoverageLabel(gap)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
          <Button
            className="flex-1"
            onClick={(e) => {
              e.stopPropagation();
              onEnroll();
            }}
          >
            <Users className="w-4 h-4 mr-2" />
            Inscribirme en este sector
          </Button>
          <Button
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails();
            }}
          >
            Ver detalles
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

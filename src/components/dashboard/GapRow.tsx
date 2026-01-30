import { AlertCircle, AlertTriangle, Eye, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { GapWithDetails } from "@/services/gapService";
import type { SignalType } from "@/types/database";

const SIGNAL_TYPE_COPY: Record<SignalType, string> = {
  field_report: "Reportado por actores en terreno",
  actor_report: "Validado por coordinación territorial",
  sms: "Basado en reportes ciudadanos (SMS)",
  news: "Detectado en contexto informativo (medios)",
  context: "Contexto inicial del evento",
  official: "Fuente oficial",
  social: "Redes sociales",
};

interface GapRowProps {
  gap: GapWithDetails;
  dominantSignalTypes: SignalType[];
  onViewSignals: () => void;
  onActivateActors: () => void;
}

function getCoverageText(gap: GapWithDetails): string {
  // Based on signals and coverage, determine text
  if (gap.coverage && gap.coverage.length > 0) {
    return "Cobertura parcial";
  }
  return "Sin cobertura";
}

function formatSignalTypes(types: SignalType[]): string {
  if (types.length === 0) return "";
  if (types.length === 1) return SIGNAL_TYPE_COPY[types[0]];
  if (types.length === 2) {
    return `${SIGNAL_TYPE_COPY[types[0]]} y ${SIGNAL_TYPE_COPY[types[1]].toLowerCase()}`;
  }
  const lastType = types[types.length - 1];
  const firstTypes = types.slice(0, -1);
  return `${firstTypes.map(t => SIGNAL_TYPE_COPY[t]).join(", ")} y ${SIGNAL_TYPE_COPY[lastType].toLowerCase()}`;
}

export function GapRow({
  gap,
  dominantSignalTypes,
  onViewSignals,
  onActivateActors,
}: GapRowProps) {
  const isCritical = gap.state === "critical";
  const Icon = isCritical ? AlertCircle : AlertTriangle;
  const capacityName = gap.capacity_type?.name || "Capacidad";
  const coverageText = getCoverageText(gap);
  const signalTypeText = formatSignalTypes(dominantSignalTypes);

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-md border-l-4 bg-muted/30",
        isCritical ? "border-l-gap-critical" : "border-l-warning"
      )}
    >
      <div className="flex-1 min-w-0">
        {/* Main line: Severity + Capacity — Coverage */}
        <div className="flex items-center gap-2 flex-wrap">
          <Icon
            className={cn(
              "w-4 h-4 shrink-0",
              isCritical ? "text-gap-critical" : "text-warning"
            )}
          />
          <span
            className={cn(
              "font-semibold",
              isCritical ? "text-gap-critical" : "text-warning"
            )}
          >
            {capacityName}
          </span>
          <span className="text-muted-foreground">—</span>
          <span className="text-foreground">{coverageText}</span>
        </div>

        {/* Signal type line */}
        {signalTypeText && (
          <p className="text-sm text-muted-foreground mt-1 truncate">
            {signalTypeText}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={onViewSignals}
          className="text-muted-foreground hover:text-foreground"
        >
          <Eye className="w-4 h-4 mr-1" />
          Ver señales
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onActivateActors}
          className="text-muted-foreground hover:text-foreground"
        >
          <Users className="w-4 h-4 mr-1" />
          Activar actores de {capacityName.toLowerCase()}
        </Button>
      </div>
    </div>
  );
}

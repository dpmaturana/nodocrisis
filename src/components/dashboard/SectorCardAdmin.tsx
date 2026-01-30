import { ChevronRight, AlertCircle, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GapRow } from "./GapRow";
import type { Sector, SignalType } from "@/types/database";
import type { GapWithDetails } from "@/services/gapService";
import type { SectorContext } from "@/services/mock/data";

interface SectorCardAdminProps {
  sector: Sector;
  context: SectorContext;
  gaps: GapWithDetails[];
  gapSignalTypes: Record<string, SignalType[]>;
  onViewDetails: () => void;
  onViewSignals: (gap: GapWithDetails) => void;
  onActivateActors: (gap: GapWithDetails) => void;
}

export function SectorCardAdmin({
  sector,
  context,
  gaps,
  gapSignalTypes,
  onViewDetails,
  onViewSignals,
  onActivateActors,
}: SectorCardAdminProps) {
  const criticalCount = gaps.filter((g) => g.state === "critical").length;
  const partialCount = gaps.filter((g) => g.state === "partial").length;
  const hasCritical = criticalCount > 0;

  // Sort gaps: critical first, then partial
  const sortedGaps = [...gaps].sort((a, b) => {
    if (a.state === "critical" && b.state !== "critical") return -1;
    if (a.state !== "critical" && b.state === "critical") return 1;
    return 0;
  });

  return (
    <Card
      className={cn(
        "border-l-4",
        hasCritical ? "border-l-gap-critical" : "border-l-warning"
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            {/* Sector name */}
            <CardTitle className="text-lg">{sector.canonical_name}</CardTitle>

            {/* Context bullets (max 2) */}
            <ul className="mt-2 space-y-1">
              {context.keyPoints.slice(0, 2).map((point, i) => (
                <li
                  key={i}
                  className="text-sm text-muted-foreground flex items-start gap-2"
                >
                  <span className="text-muted-foreground/50">•</span>
                  {point}
                </li>
              ))}
            </ul>
          </div>

          {/* Gap summary badges and CTA */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Gap counts */}
            <div className="flex items-center gap-2">
              {criticalCount > 0 && (
                <div className="flex items-center gap-1 text-gap-critical">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">{criticalCount}</span>
                </div>
              )}
              {partialCount > 0 && (
                <div className="flex items-center gap-1 text-warning">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm font-medium">{partialCount}</span>
                </div>
              )}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={onViewDetails}
              className="text-muted-foreground hover:text-foreground"
            >
              Ver detalles
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Gap rows */}
        <div className="space-y-2">
          {sortedGaps.map((gap) => (
            <GapRow
              key={gap.id}
              gap={gap}
              dominantSignalTypes={gapSignalTypes[gap.id] || []}
              onViewSignals={() => onViewSignals(gap)}
              onActivateActors={() => onActivateActors(gap)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

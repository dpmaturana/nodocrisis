import type { MapSector, MapGap } from "./types";

interface SectorTooltipProps {
  sector: MapSector;
  viewerRole: "ngo" | "admin";
  orgCapabilities: string[];
}

const statusConfig = {
  critical: { icon: "🔴", label: "Critical sector" },
  partial: { icon: "🟠", label: "Partial sector" },
  operating: { icon: "🟢", label: "Operating" },
};

function sortGaps(gaps: MapGap[]): MapGap[] {
  return [...gaps].sort((a, b) => {
    // Critical first
    if (a.severity === "critical" && b.severity !== "critical") return -1;
    if (a.severity !== "critical" && b.severity === "critical") return 1;
    // Then alphabetically
    return a.capabilityName.localeCompare(b.capabilityName);
  });
}

function getMissingGaps(gaps: MapGap[]): MapGap[] {
  return gaps.filter(g => g.coverage !== "full");
}

function formatGapsList(gaps: MapGap[], max: number = 3): string {
  if (gaps.length === 0) return "";
  
  const displayed = gaps.slice(0, max).map(g => g.capabilityName);
  const remaining = gaps.length - max;
  
  if (remaining > 0) {
    return `${displayed.join(", ")} (+${remaining})`;
  }
  return displayed.join(", ");
}

export function SectorTooltip({ sector, viewerRole, orgCapabilities }: SectorTooltipProps) {
  const { icon, label } = statusConfig[sector.status];
  const missingGaps = sortGaps(getMissingGaps(sector.gaps));

  if (viewerRole === "admin") {
    return (
      <div className="min-w-[180px] max-w-[280px]">
        <div className="font-semibold text-sm mb-1">{sector.name}</div>
        <div className="text-xs mb-2">{icon} {label}</div>
        {missingGaps.length > 0 ? (
          <div className="text-xs">
            <span className="font-medium">Missing:</span>{" "}
            {formatGapsList(missingGaps)}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">All gaps covered</div>
        )}
      </div>
    );
  }

  // NGO view - filter by org capabilities
  const matchingGaps = missingGaps.filter(g => 
    orgCapabilities.includes(g.capabilityName)
  );
  const otherGapsCount = missingGaps.length - matchingGaps.length;

  return (
    <div className="min-w-[180px] max-w-[280px]">
      <div className="font-semibold text-sm mb-1">{sector.name}</div>
      <div className="text-xs mb-2">{icon} {label}</div>
      
      {matchingGaps.length > 0 ? (
        <div className="text-xs mb-1">
          <span className="font-medium">You can provide:</span>{" "}
          {formatGapsList(matchingGaps)}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground mb-1">
          No gaps aligned with your capabilities
        </div>
      )}
      
      {otherGapsCount > 0 && (
        <div className="text-xs text-muted-foreground">
          Other gaps in sector: +{otherGapsCount}
        </div>
      )}
    </div>
  );
}

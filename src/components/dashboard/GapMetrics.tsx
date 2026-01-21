import { useEffect, useState } from "react";
import { AlertCircle, AlertTriangle, MapPin, Activity } from "lucide-react";
import { gapService, type GapCounts } from "@/services";
import { 
  MOCK_DEPLOYMENTS,
  getOperatingCount,
} from "@/services/mock/data";
import { StatCard } from "@/components/ui/StatCard";
import { Skeleton } from "@/components/ui/skeleton";

interface GapMetricsProps {
  eventId: string;
}

export function GapMetrics({ eventId }: GapMetricsProps) {
  const [counts, setCounts] = useState<GapCounts | null>(null);
  const [operatingCount, setOperatingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCounts = async () => {
      setIsLoading(true);
      try {
        const [gapCounts] = await Promise.all([
          gapService.getCounts(eventId),
        ]);
        setCounts(gapCounts);
        setOperatingCount(getOperatingCount(eventId));
      } catch (error) {
        console.error("Error fetching gap metrics:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCounts();
  }, [eventId]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="Sectores con brechas"
        value={counts?.sectorsWithGaps || 0}
        subtitle="Requieren coordinación"
        icon={MapPin}
        variant={counts?.sectorsWithGaps ? "warning" : "default"}
      />
      <StatCard
        title="Brechas críticas"
        value={counts?.critical || 0}
        subtitle={counts?.critical === 0 ? "Sin brechas críticas" : "Atención inmediata"}
        icon={AlertCircle}
        variant={counts?.critical ? "critical" : "success"}
      />
      <StatCard
        title="Brechas parciales"
        value={counts?.partial || 0}
        subtitle="Cobertura insuficiente"
        icon={AlertTriangle}
        variant={counts?.partial ? "warning" : "default"}
      />
      <StatCard
        title="Actores operando"
        value={operatingCount}
        subtitle="En terreno ahora"
        icon={Activity}
        variant="success"
      />
    </div>
  );
}

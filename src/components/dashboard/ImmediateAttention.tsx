import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { AlertCircle, AlertTriangle, Eye, Users, ChevronRight } from "lucide-react";
import { gapService, type GapWithDetails } from "@/services";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ImmediateAttentionProps {
  eventId: string;
  onViewGap?: (gap: GapWithDetails) => void;
  onViewActors?: (gap: GapWithDetails) => void;
}

export function ImmediateAttention({ 
  eventId, 
  onViewGap,
  onViewActors,
}: ImmediateAttentionProps) {
  const [gaps, setGaps] = useState<GapWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchGaps = async () => {
      setIsLoading(true);
      try {
        const visibleGaps = await gapService.getVisibleGapsForEvent(eventId);
        setGaps(visibleGaps);
      } catch (error) {
        console.error("Error fetching gaps:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchGaps();
  }, [eventId]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (gaps.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Atención Inmediata</CardTitle>
          <CardDescription>Brechas que requieren coordinación</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-coverage/20 flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-coverage" />
            </div>
            <p className="text-lg font-medium text-coverage">Sin brechas críticas por ahora</p>
            <p className="text-sm text-muted-foreground mt-1">
              Todos los sectores están siendo monitoreados
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Atención Inmediata</CardTitle>
        <CardDescription>
          {gaps.length} brecha{gaps.length !== 1 ? 's' : ''} que requiere{gaps.length === 1 ? '' : 'n'} coordinación
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {gaps.map((gap) => (
          <GapItem 
            key={gap.id} 
            gap={gap} 
            onViewGap={onViewGap}
            onViewActors={onViewActors}
          />
        ))}
      </CardContent>
    </Card>
  );
}

interface GapItemProps {
  gap: GapWithDetails;
  onViewGap?: (gap: GapWithDetails) => void;
  onViewActors?: (gap: GapWithDetails) => void;
}

function GapItem({ gap, onViewGap, onViewActors }: GapItemProps) {
  const isCritical = gap.state === 'critical';
  const Icon = isCritical ? AlertCircle : AlertTriangle;
  const timeAgo = formatDistanceToNow(new Date(gap.last_updated_at), { 
    addSuffix: false, 
    locale: es 
  });

  return (
    <div className={cn(
      "flex items-center justify-between p-4 rounded-lg border transition-colors",
      isCritical 
        ? "border-gap-critical/30 bg-gap-critical/5 hover:bg-gap-critical/10" 
        : "border-warning/30 bg-warning/5 hover:bg-warning/10"
    )}>
      <div className="flex items-center gap-4">
        {/* State indicator */}
        <div className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center",
          isCritical ? "bg-gap-critical/20" : "bg-warning/20"
        )}>
          <Icon className={cn(
            "w-5 h-5",
            isCritical ? "text-gap-critical" : "text-warning"
          )} />
        </div>

        {/* Content */}
        <div>
          <div className="flex items-center gap-2">
            <span className={cn(
              "font-semibold",
              isCritical ? "text-gap-critical" : "text-warning"
            )}>
              {gap.capacity_type?.name || "Capacidad"}
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="text-foreground">
              {gap.sector?.canonical_name || "Sector"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Hace {timeAgo} · {gap.signal_count} señal{gap.signal_count !== 1 ? 'es' : ''}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => onViewGap?.(gap)}
          className="text-muted-foreground hover:text-foreground"
        >
          <Eye className="w-4 h-4 mr-1" />
          Ver brecha
        </Button>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => onViewActors?.(gap)}
          className="text-muted-foreground hover:text-foreground"
        >
          <Users className="w-4 h-4 mr-1" />
          Ver actores
        </Button>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { deploymentService, type SectorDeploymentGroup } from "@/services/deploymentService";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { SectorDeploymentCard } from "@/components/deployments/SectorDeploymentCard";
import { MapPin, ChevronDown, History } from "@/lib/icons";

export default function MyDeployments() {
  const { user } = useAuth();
  const [sectorGroups, setSectorGroups] = useState<SectorDeploymentGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDeployments = async () => {
    if (!user) return;

    try {
      const data = await deploymentService.getMyDeploymentsGrouped(user.id);
      setSectorGroups(data);
    } catch (error) {
      console.error("Error fetching deployments:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDeployments();
  }, [user]);

  const handleRefresh = () => {
    fetchDeployments();
  };

  // Separate active from history
  const activeGroups = sectorGroups.filter(
    (g) => !g.deployments.every((d) => d.status === "finished" || d.status === "suspended")
  );
  const historyGroups = sectorGroups.filter((g) =>
    g.deployments.every((d) => d.status === "finished" || d.status === "suspended")
  );
  const historyCount = historyGroups.reduce((acc, g) => acc + g.deployments.length, 0);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Deployments</h1>
          <p className="text-muted-foreground mt-1">
            Manage your enrollments and deployments in emergency sectors
          </p>
        </div>
        {activeGroups.length > 0 && (
          <Button variant="outline" size="sm" asChild>
            <Link to="/sectors">
              <MapPin className="w-4 h-4 mr-2" />
              Find new sectors to support
            </Link>
          </Button>
        )}
      </div>

      {/* Active Deployments grouped by Sector */}
      {activeGroups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <MapPin className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground mb-4">You have no active deployments</p>
            <Button variant="outline" asChild>
              <Link to="/sectors">
                <MapPin className="w-4 h-4 mr-2" />
                Find sectors to help
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {activeGroups.map((group) => (
            <SectorDeploymentCard
              key={`${group.sector.id}-${group.event.id}`}
              group={group}
              actorId={user?.id || ""}
              onRefresh={handleRefresh}
            />
          ))}
        </div>
      )}

      {/* History - Collapsible */}
      {historyGroups.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-between text-muted-foreground hover:text-foreground"
            >
              <span className="flex items-center gap-2">
                <History className="w-4 h-4" />
                History ({historyCount} past deployments)
              </span>
              <ChevronDown className="w-4 h-4" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 mt-4">
            {historyGroups.map((group) => (
              <HistorySectorCard key={`history-${group.sector.id}-${group.event.id}`} group={group} />
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

// Simplified card for history
function HistorySectorCard({ group }: { group: SectorDeploymentGroup }) {
  const { sector, event, deployments } = group;

  return (
    <Card className="opacity-70">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">{sector.canonical_name}</span>
            </div>
            <p className="text-sm text-muted-foreground">{event.name}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">
              {deployments.length} {deployments.length !== 1 ? "capabilities" : "capability"}
            </p>
            <p className="text-xs text-muted-foreground">
              {deployments.every((d) => d.status === "finished") ? "Finished" : "Suspended"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

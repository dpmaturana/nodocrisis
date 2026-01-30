import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useActorMode } from "@/hooks/useActorMode";
import { sectorService, capabilityService } from "@/services";
import type { EnrichedSector } from "@/services/sectorService";
import type { ActorCapability } from "@/types/database";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, ArrowLeft, MapPin, Plus } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { SectorCard } from "@/components/sectors/SectorCard";
import { SectorDetailDrawer } from "@/components/sectors/SectorDetailDrawer";
import { EnrollmentModal } from "@/components/sectors/EnrollmentModal";

export default function Sectors() {
  const { user, isActor, isAdmin } = useAuth();
  const { isOperating } = useActorMode();
  const [sectors, setSectors] = useState<EnrichedSector[]>([]);
  const [userCapabilities, setUserCapabilities] = useState<ActorCapability[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSector, setSelectedSector] = useState<EnrichedSector | null>(null);
  const [enrollingSector, setEnrollingSector] = useState<EnrichedSector | null>(null);
  const [otherSectorsOpen, setOtherSectorsOpen] = useState(false);

  const navigate = useNavigate();

  // Show back button for actors in operation mode
  const showBackButton = isActor && !isAdmin && isOperating;

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        const [enrichedSectors, capabilities] = await Promise.all([
          sectorService.getEnrichedSectors(user.id),
          capabilityService.getByActor(user.id),
        ]);

        setSectors(enrichedSectors);
        setUserCapabilities(capabilities);
      } catch (error) {
        console.error("Error fetching sectors:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const handleEnrollmentSuccess = () => {
    // Navigate to Mode B (Operation) after successful enrollment
    navigate("/my-deployments");
  };

  // Separate by relevance to user's capabilities
  const relevantSectors = sectors.filter((s) => s.relevantGaps.length > 0);
  const otherSectors = sectors.filter((s) => s.relevantGaps.length === 0);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-5 w-96" />
        </div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4">
        {showBackButton && (
          <Button variant="ghost" size="sm" className="w-fit -ml-2" asChild>
            <Link to="/my-deployments">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to My Deployments
            </Link>
          </Button>
        )}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Where your organization is needed most</h1>
          <p className="text-muted-foreground mt-1">Sectors prioritized based on your capabilities</p>
        </div>
      </div>

      {/* No capabilities warning */}
      {userCapabilities.length === 0 && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="flex items-center gap-4 py-4">
            <AlertTriangle className="w-8 h-8 text-warning" />
            <div className="flex-1">
              <p className="font-medium">You have no declared capabilities</p>
              <p className="text-sm text-muted-foreground">
                Add your capabilities to see sectors recommended specifically for you.
              </p>
            </div>
            <Button asChild>
              <Link to="/my-capabilities">
                <Plus className="w-4 h-4 mr-2" />
                Add Capabilities
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* No match warning (has capabilities but no match) */}
      {userCapabilities.length > 0 && relevantSectors.length === 0 && otherSectors.length > 0 && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="flex items-center gap-4 py-4">
            <AlertTriangle className="w-8 h-8 text-warning" />
            <div className="flex-1">
              <p className="font-medium">No sectors match your capabilities</p>
              <p className="text-sm text-muted-foreground">
                You can view other sectors with active gaps below, or add more capabilities to your profile.
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link to="/my-capabilities">Edit Capabilities</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Relevant Sectors (matching user's capabilities) */}
      {relevantSectors.length > 0 && (
        <div className="space-y-4">
          {relevantSectors.map((sector) => (
            <SectorCard
              key={sector.sector.id}
              sector={sector}
              onViewDetails={() => setSelectedSector(sector)}
              onEnroll={() => setEnrollingSector(sector)}
            />
          ))}
        </div>
      )}

      {/* Other Sectors (no match) - Collapsible */}
      {otherSectors.length > 0 && (
        <Collapsible open={otherSectorsOpen} onOpenChange={setOtherSectorsOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground py-2">
            <ChevronDown className={`w-4 h-4 transition-transform ${otherSectorsOpen ? "rotate-180" : ""}`} />
            Other sectors with gaps ({otherSectors.length})
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-2">
            {otherSectors.map((sector) => (
              <SectorCard
                key={sector.sector.id}
                sector={sector}
                onViewDetails={() => setSelectedSector(sector)}
                onEnroll={() => setEnrollingSector(sector)}
              />
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Empty State */}
      {sectors.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <MapPin className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No sectors with active gaps</h3>
            <p className="text-muted-foreground max-w-md">
              All sectors currently have adequate coverage or there are no active events.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Sector Detail Drawer */}
      <SectorDetailDrawer
        sector={selectedSector}
        open={!!selectedSector}
        onOpenChange={(open) => !open && setSelectedSector(null)}
        onEnroll={() => {
          setEnrollingSector(selectedSector);
          setSelectedSector(null);
        }}
      />

      {/* Enrollment Modal */}
      {user && (
        <EnrollmentModal
          sector={enrollingSector}
          userCapabilities={userCapabilities}
          userId={user.id}
          open={!!enrollingSector}
          onOpenChange={(open) => !open && setEnrollingSector(null)}
          onSuccess={handleEnrollmentSuccess}
        />
      )}
    </div>
  );
}

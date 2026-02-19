import { useState, useEffect } from "react";
import { Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActorListFilters } from "@/components/actors/ActorListFilters";
import { ActorRow } from "@/components/actors/ActorRow";
import { ActorDetailDrawer } from "@/components/actors/ActorDetailDrawer";
import { ActorForm } from "@/components/actors/ActorForm";
import { actorNetworkService } from "@/services/actorNetworkService";
import { capabilityService } from "@/services/capabilityService";
import type { ActorWithDetails, ActorType, ActorStructuralStatus, CapacityType } from "@/types/database";
import { useToast } from "@/hooks/use-toast";

export default function ActorNetwork() {
  const [actors, setActors] = useState<ActorWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedActor, setSelectedActor] = useState<ActorWithDetails | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingActor, setEditingActor] = useState<ActorWithDetails | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [capacityFilter, setCapacityFilter] = useState<string | null>(null);
  const [regionFilter, setRegionFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<ActorType | null>(null);
  const [capacityTypes, setCapacityTypes] = useState<CapacityType[]>([]);

  const { toast } = useToast();

  useEffect(() => {
    capabilityService.getCapacityTypes().then(setCapacityTypes).catch(() => {});
  }, []);

  const loadActors = async () => {
    setLoading(true);
    try {
      const result = await actorNetworkService.filterMultiple({
        query: searchQuery || undefined,
        capacityTypeId: capacityFilter || undefined,
        region: regionFilter || undefined,
        type: typeFilter || undefined,
      });
      setActors(result);
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron cargar los actores",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActors();
  }, [searchQuery, capacityFilter, regionFilter, typeFilter]);

  const handleViewActor = (actor: ActorWithDetails) => {
    setSelectedActor(actor);
    setShowDrawer(true);
  };

  const handleEditActor = (actor: ActorWithDetails) => {
    setEditingActor(actor);
    setShowForm(true);
    setShowDrawer(false);
  };

  const handleCreateActor = () => {
    setEditingActor(null);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingActor(null);
    loadActors();
  };

  const handleDrawerClose = () => {
    setShowDrawer(false);
    setSelectedActor(null);
    loadActors();
  };

  const handleStatusChange = async (actorId: string, status: ActorStructuralStatus) => {
    try {
      await actorNetworkService.setStatus(actorId, status);
      toast({
        title: "Estado actualizado",
        description: `Actor marcado como ${status === "active" ? "activo" : "inactivo"}`,
      });
      loadActors();
      // Update selected actor if open
      if (selectedActor?.actor.id === actorId) {
        const updated = await actorNetworkService.getById(actorId);
        setSelectedActor(updated);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo actualizar el estado",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-6 w-6 text-muted-foreground" />
            <h1 className="text-2xl font-semibold">Organizational network</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            Structured capacity management. Registry of organizations, capabilities, operating areas, and contacts.
          </p>
        </div>
        <Button onClick={handleCreateActor} className="shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          Register new Organization
        </Button>
      </div>

      {/* Filters */}
      <ActorListFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        capacityFilter={capacityFilter}
        onCapacityChange={setCapacityFilter}
        regionFilter={regionFilter}
        onRegionChange={setRegionFilter}
        typeFilter={typeFilter}
        onTypeChange={setTypeFilter}
        capacityTypes={capacityTypes}
      />

      {/* List */}
      <div className="space-y-3 mt-6">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading organizations...</div>
        ) : actors.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No results found for the selected filters</div>
        ) : (
          actors.map((actor) => <ActorRow key={actor.actor.id} actor={actor} onView={() => handleViewActor(actor)} />)
        )}
      </div>

      {/* Detail Drawer */}
      <ActorDetailDrawer
        actor={selectedActor}
        open={showDrawer}
        onClose={handleDrawerClose}
        onEdit={handleEditActor}
        onStatusChange={handleStatusChange}
      />

      {/* Create/Edit Form */}
      <ActorForm actor={editingActor} open={showForm} onClose={handleFormClose} />
    </div>
  );
}

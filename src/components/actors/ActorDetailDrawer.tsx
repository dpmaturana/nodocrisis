import { useState } from "react";
import { Building2, Edit, Power, PowerOff, Plus } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CapabilityDeclaredList } from "./CapabilityDeclaredList";
import { HabitualZonesList } from "./HabitualZonesList";
import { ContactsList } from "./ContactsList";
import { ParticipationHistory } from "./ParticipationHistory";
import { CapabilityForm } from "./CapabilityForm";
import { ZoneForm } from "./ZoneForm";
import { ContactsForm } from "./ContactsForm";
import type { ActorWithDetails, ActorStructuralStatus } from "@/types/database";
import { ACTOR_TYPE_LABELS } from "@/types/database";
import { actorNetworkService } from "@/services/actorNetworkService";
import { useToast } from "@/hooks/use-toast";

interface ActorDetailDrawerProps {
  actor: ActorWithDetails | null;
  open: boolean;
  onClose: () => void;
  onEdit: (actor: ActorWithDetails) => void;
  onStatusChange: (actorId: string, status: ActorStructuralStatus) => void;
}

export function ActorDetailDrawer({
  actor,
  open,
  onClose,
  onEdit,
  onStatusChange,
}: ActorDetailDrawerProps) {
  const [showCapabilityForm, setShowCapabilityForm] = useState(false);
  const [showZoneForm, setShowZoneForm] = useState(false);
  const [showContactsForm, setShowContactsForm] = useState(false);
  const { toast } = useToast();

  if (!actor) return null;

  const { actor: actorData, capabilities, zones, contacts, capacityTypeNames } = actor;

  const handleToggleStatus = () => {
    const newStatus: ActorStructuralStatus =
      actorData.structural_status === "active" ? "inactive" : "active";
    onStatusChange(actorData.id, newStatus);
  };

  const handleCapabilityAdded = () => {
    setShowCapabilityForm(false);
    onClose(); // Refresh by closing and reopening
  };

  const handleZoneAdded = () => {
    setShowZoneForm(false);
    onClose();
  };

  const handleContactsSaved = () => {
    setShowContactsForm(false);
    onClose();
  };

  const handleRemoveCapability = async (capabilityId: string) => {
    try {
      await actorNetworkService.removeCapability(capabilityId);
      toast({ title: "Capability removed" });
      onClose();
    } catch (error) {
      toast({ title: "Error al eliminar", variant: "destructive" });
    }
  };

  const handleRemoveZone = async (zoneId: string) => {
    try {
      await actorNetworkService.removeZone(zoneId);
      toast({ title: "Zone removed" });
      onClose();
    } catch (error) {
      toast({ title: "Error al eliminar", variant: "destructive" });
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
        <SheetContent className="w-full sm:max-w-lg p-0">
          <ScrollArea className="h-full">
            <div className="p-6">
              <SheetHeader className="text-left">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-muted rounded-lg">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <SheetTitle className="text-xl">
                      {actorData.organization_name}
                    </SheetTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline">
                        {ACTOR_TYPE_LABELS[actorData.organization_type]}
                      </Badge>
                      <Badge
                        variant={actorData.structural_status === "active" ? "default" : "secondary"}
                        className={
                          actorData.structural_status === "active"
                            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0"
                            : ""
                        }
                      >
                        {actorData.structural_status === "active" ? "Activo" : "Inactivo"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </SheetHeader>

              {/* Description */}
              {actorData.description && (
                <p className="text-muted-foreground text-sm mt-4">
                  {actorData.description}
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-2 mt-4">
                <Button variant="outline" size="sm" onClick={() => onEdit(actor)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToggleStatus}
                >
                  {actorData.structural_status === "active" ? (
                    <>
                      <PowerOff className="h-4 w-4 mr-2" />
                      Desactivar
                    </>
                  ) : (
                    <>
                      <Power className="h-4 w-4 mr-2" />
                      Activar
                    </>
                  )}
                </Button>
              </div>

              <Separator className="my-6" />

              {/* Capacidades Declaradas */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Capacidades Declaradas</h3>
                  <Button variant="ghost" size="sm" onClick={() => setShowCapabilityForm(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Agregar
                  </Button>
                </div>
                <CapabilityDeclaredList
                  capabilities={capabilities}
                  capacityTypeNames={capacityTypeNames}
                  onRemove={handleRemoveCapability}
                />
              </div>

              <Separator className="my-6" />

              {/* Zonas Habituales */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Zonas Habituales</h3>
                  <Button variant="ghost" size="sm" onClick={() => setShowZoneForm(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Agregar
                  </Button>
                </div>
                <HabitualZonesList zones={zones} onRemove={handleRemoveZone} />
              </div>

              <Separator className="my-6" />

              {/* Contactos */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Contactos</h3>
                  <Button variant="ghost" size="sm" onClick={() => setShowContactsForm(true)}>
                    <Edit className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                </div>
                <ContactsList contacts={contacts} />
              </div>

              <Separator className="my-6" />

              {/* Historial de Participación */}
              <div className="space-y-3">
                <h3 className="font-medium">Historial de Participación</h3>
                <ParticipationHistory actorId={actorData.id} />
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Sub-forms */}
      <CapabilityForm
        actorId={actorData.id}
        open={showCapabilityForm}
        onClose={() => setShowCapabilityForm(false)}
        onSaved={handleCapabilityAdded}
      />
      <ZoneForm
        actorId={actorData.id}
        open={showZoneForm}
        onClose={() => setShowZoneForm(false)}
        onSaved={handleZoneAdded}
      />
      <ContactsForm
        actorId={actorData.id}
        existingContacts={contacts}
        open={showContactsForm}
        onClose={() => setShowContactsForm(false)}
        onSaved={handleContactsSaved}
      />
    </>
  );
}
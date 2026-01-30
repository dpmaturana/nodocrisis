import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { actorNetworkService } from "@/services/actorNetworkService";
import type { ActorWithDetails, ActorType, ActorStructuralStatus } from "@/types/database";
import { ACTOR_TYPE_LABELS } from "@/types/database";
import { useToast } from "@/hooks/use-toast";

interface ActorFormProps {
  actor: ActorWithDetails | null; // null = create mode
  open: boolean;
  onClose: () => void;
}

export function ActorForm({ actor, open, onClose }: ActorFormProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<ActorType>("ong");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const isEditing = !!actor;

  useEffect(() => {
    if (actor) {
      setName(actor.actor.organization_name);
      setType(actor.actor.organization_type);
      setDescription(actor.actor.description || "");
      setIsActive(actor.actor.structural_status === "active");
    } else {
      setName("");
      setType("ong");
      setDescription("");
      setIsActive(true);
    }
  }, [actor, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: "El nombre es requerido", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const status: ActorStructuralStatus = isActive ? "active" : "inactive";

      if (isEditing && actor) {
        await actorNetworkService.update(actor.actor.id, {
          organization_name: name.trim(),
          organization_type: type,
          description: description.trim() || undefined,
          structural_status: status,
        });
        toast({ title: "Actor actualizado" });
      } else {
        await actorNetworkService.create({
          user_id: `user-${Date.now()}`, // Demo user ID
          organization_name: name.trim(),
          organization_type: type,
          description: description.trim() || undefined,
          structural_status: status,
        });
        toast({ title: "Actor registrado" });
      }
      onClose();
    } catch (error) {
      toast({ title: "Error al guardar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Actor" : "Registrar Actor"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre de la organización *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Cruz Roja Chile"
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Tipo de actor</Label>
            <Select value={type} onValueChange={(v) => setType(v as ActorType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(ACTOR_TYPE_LABELS) as [ActorType, string][]).map(
                  ([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción breve</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Breve descripción de la organización (máx. 200 caracteres)"
              maxLength={200}
              rows={3}
            />
            <p className="text-xs text-muted-foreground text-right">
              {description.length}/200
            </p>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="status">Estado estructural</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {isActive ? "Activo" : "Inactivo"}
              </span>
              <Switch
                id="status"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando..." : isEditing ? "Guardar cambios" : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
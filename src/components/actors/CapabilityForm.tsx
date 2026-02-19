import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { actorNetworkService } from "@/services/actorNetworkService";
import { capabilityService } from "@/services/capabilityService";
import type { CapabilityLevel, CapacityType } from "@/types/database";
import { CAPABILITY_LEVEL_LABELS } from "@/types/database";
import { useToast } from "@/hooks/use-toast";

interface CapabilityFormProps {
  actorId: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function CapabilityForm({ actorId, open, onClose, onSaved }: CapabilityFormProps) {
  const [capacityTypeId, setCapacityTypeId] = useState("");
  const [level, setLevel] = useState<CapabilityLevel>("operational");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [capacityTypes, setCapacityTypes] = useState<CapacityType[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      capabilityService.getCapacityTypes().then(setCapacityTypes).catch(() => {});
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!capacityTypeId) {
      toast({ title: "Selecciona una capacidad", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      await actorNetworkService.addCapability(actorId, {
        capacity_type_id: capacityTypeId,
        level,
        notes: notes.trim() || undefined,
      });
      toast({ title: "Capacidad agregada" });
      setCapacityTypeId("");
      setLevel("operational");
      setNotes("");
      onSaved();
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
          <DialogTitle>Agregar Capacidad</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de capacidad *</Label>
            <Select value={capacityTypeId} onValueChange={setCapacityTypeId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar capacidad" />
              </SelectTrigger>
              <SelectContent>
                {capacityTypes.map((cap) => (
                  <SelectItem key={cap.id} value={cap.id}>
                    {cap.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Nivel</Label>
            <Select value={level} onValueChange={(v) => setLevel(v as CapabilityLevel)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(CAPABILITY_LEVEL_LABELS) as [CapabilityLevel, string][]).map(
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
            <Label>Observaciones (opcional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Flota de 5 vehículos 4x4"
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Agregar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
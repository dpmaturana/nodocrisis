import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { actorNetworkService } from "@/services/actorNetworkService";
import { CHILE_REGIONS, type PresenceType } from "@/types/database";
import { useToast } from "@/hooks/use-toast";

interface ZoneFormProps {
  actorId: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function ZoneForm({ actorId, open, onClose, onSaved }: ZoneFormProps) {
  const [region, setRegion] = useState("");
  const [commune, setCommune] = useState("");
  const [presenceType, setPresenceType] = useState<PresenceType>("habitual");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!region) {
      toast({ title: "Selecciona una región", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      await actorNetworkService.addZone(actorId, {
        region,
        commune: commune.trim() || undefined,
        presence_type: presenceType,
      });
      toast({ title: "Zona agregada" });
      setRegion("");
      setCommune("");
      setPresenceType("habitual");
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
          <DialogTitle>Agregar Zona Habitual</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Región *</Label>
            <Select value={region} onValueChange={setRegion}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar región" />
              </SelectTrigger>
              <SelectContent>
                {CHILE_REGIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Comuna (opcional)</Label>
            <Input
              value={commune}
              onChange={(e) => setCommune(e.target.value)}
              placeholder="Ej: Chillán"
            />
          </div>

          <div className="space-y-2">
            <Label>Tipo de presencia</Label>
            <Select
              value={presenceType}
              onValueChange={(v) => setPresenceType(v as PresenceType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="habitual">Habitual</SelectItem>
                <SelectItem value="occasional">Ocasional</SelectItem>
              </SelectContent>
            </Select>
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
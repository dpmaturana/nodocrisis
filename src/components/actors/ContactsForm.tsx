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
import { Separator } from "@/components/ui/separator";
import { actorNetworkService, type ContactInput } from "@/services/actorNetworkService";
import type { ActorContact } from "@/types/database";
import { useToast } from "@/hooks/use-toast";

interface ContactsFormProps {
  actorId: string;
  existingContacts: ActorContact[];
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

interface ContactFormData {
  name: string;
  role: string;
  email: string;
  phone: string;
  is_primary: boolean;
}

const emptyContact: ContactFormData = {
  name: "",
  role: "",
  email: "",
  phone: "",
  is_primary: false,
};

export function ContactsForm({
  actorId,
  existingContacts,
  open,
  onClose,
  onSaved,
}: ContactsFormProps) {
  const [contact1, setContact1] = useState<ContactFormData>({ ...emptyContact, is_primary: true });
  const [contact2, setContact2] = useState<ContactFormData>(emptyContact);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (existingContacts.length > 0) {
      const primary = existingContacts.find(c => c.is_primary) || existingContacts[0];
      const secondary = existingContacts.find(c => !c.is_primary && c.id !== primary.id);

      setContact1({
        name: primary.name,
        role: primary.role || "",
        email: primary.email || "",
        phone: primary.phone || "",
        is_primary: true,
      });

      if (secondary) {
        setContact2({
          name: secondary.name,
          role: secondary.role || "",
          email: secondary.email || "",
          phone: secondary.phone || "",
          is_primary: false,
        });
      } else {
        setContact2(emptyContact);
      }
    } else {
      setContact1({ ...emptyContact, is_primary: true });
      setContact2(emptyContact);
    }
  }, [existingContacts, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!contact1.name.trim()) {
      toast({ title: "El nombre del contacto principal es requerido", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const contacts: ContactInput[] = [];

      contacts.push({
        name: contact1.name.trim(),
        role: contact1.role.trim() || undefined,
        email: contact1.email.trim() || undefined,
        phone: contact1.phone.trim() || undefined,
        is_primary: true,
      });

      if (contact2.name.trim()) {
        contacts.push({
          name: contact2.name.trim(),
          role: contact2.role.trim() || undefined,
          email: contact2.email.trim() || undefined,
          phone: contact2.phone.trim() || undefined,
          is_primary: false,
        });
      }

      await actorNetworkService.setContacts(actorId, contacts);
      toast({ title: "Contactos actualizados" });
      onSaved();
    } catch (error) {
      toast({ title: "Error al guardar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gestionar Contactos</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Contact 1 - Primary */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Contacto Principal *</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nombre</Label>
                <Input
                  value={contact1.name}
                  onChange={(e) => setContact1({ ...contact1, name: e.target.value })}
                  placeholder="María González"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Rol</Label>
                <Input
                  value={contact1.role}
                  onChange={(e) => setContact1({ ...contact1, role: e.target.value })}
                  placeholder="Coordinadora"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Teléfono</Label>
                <Input
                  value={contact1.phone}
                  onChange={(e) => setContact1({ ...contact1, phone: e.target.value })}
                  placeholder="+56 9 1234 5678"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <Input
                  value={contact1.email}
                  onChange={(e) => setContact1({ ...contact1, email: e.target.value })}
                  placeholder="email@org.cl"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Contact 2 - Alternate */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Contacto Alternativo (opcional)</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nombre</Label>
                <Input
                  value={contact2.name}
                  onChange={(e) => setContact2({ ...contact2, name: e.target.value })}
                  placeholder="Pedro Fernández"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Rol</Label>
                <Input
                  value={contact2.role}
                  onChange={(e) => setContact2({ ...contact2, role: e.target.value })}
                  placeholder="Jefe Logística"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Teléfono</Label>
                <Input
                  value={contact2.phone}
                  onChange={(e) => setContact2({ ...contact2, phone: e.target.value })}
                  placeholder="+56 9 8765 4321"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <Input
                  value={contact2.email}
                  onChange={(e) => setContact2({ ...contact2, email: e.target.value })}
                  placeholder="email@org.cl"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Guardar contactos"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

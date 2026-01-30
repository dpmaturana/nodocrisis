import { Phone, Mail, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ActorContact } from "@/types/database";

interface ContactsListProps {
  contacts: ActorContact[];
}

export function ContactsList({ contacts }: ContactsListProps) {
  if (contacts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        No hay contactos registrados
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {contacts.map((contact) => (
        <div
          key={contact.id}
          className="p-3 bg-muted/50 rounded-lg"
        >
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">{contact.name}</span>
            {contact.is_primary && (
              <Badge variant="default" className="text-xs">
                Principal
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">{contact.role}</p>
          <div className="flex flex-col gap-1 mt-2">
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-3 w-3 text-muted-foreground" />
              <span>{contact.primary_channel}</span>
            </div>
            {contact.secondary_channel && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-3 w-3" />
                <span>{contact.secondary_channel}</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
import { Button } from "@/components/ui/button";
import { Shield, Users } from "@/lib/icons";
import { useMockAuth } from "@/hooks/useMockAuth";

export function RoleSwitcher() {
  const { currentRole, toggleRole } = useMockAuth();

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggleRole}
      className="gap-2"
    >
      {currentRole === "admin" ? (
        <>
          <Shield className="w-4 h-4" />
          <span>Admin</span>
        </>
      ) : (
        <>
          <Users className="w-4 h-4" />
          <span>Actor</span>
        </>
      )}
      <span className="text-xs text-muted-foreground">(click para cambiar)</span>
    </Button>
  );
}

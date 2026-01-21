import { Button } from "@/components/ui/button";
import { Shield, Users } from "@/lib/icons";
import { useAuth } from "@/hooks/useAuth";

export function RoleSwitcher() {
  const { isAdmin } = useAuth();

  // Role is now determined by database - display only
  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2 cursor-default"
      disabled
    >
      {isAdmin ? (
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
    </Button>
  );
}

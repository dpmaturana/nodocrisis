import { NavLink, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Activity, BarChart3, Plus, Users, Archive, LogOut, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function TopNavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
          isActive ? "bg-accent text-foreground" : "text-muted-foreground"
        )
      }
    >
      {children}
    </NavLink>
  );
}

export function AdminTopNav() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <header className="sticky top-0 z-50 h-14 border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-full items-center justify-between px-4">
        {/* Left: Logo + Nav Links */}
        <div className="flex items-center gap-6">
          {/* Logo */}
          <NavLink to="/admin/event-dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-primary/20 flex items-center justify-center">
              <Activity className="w-4 h-4 text-primary" />
            </div>
            <span className="font-semibold text-foreground">NodoCrisis</span>
          </NavLink>

          {/* Nav Links */}
          <nav className="flex items-center gap-1">
            <TopNavLink to="/admin/event-dashboard">
              <span className="flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4" />
                Dashboard
              </span>
            </TopNavLink>
            <TopNavLink to="/admin/create-event">
              <span className="flex items-center gap-1.5">
                <Plus className="w-4 h-4" />
                New Emergency
              </span>
            </TopNavLink>
            <TopNavLink to="/admin/actors">
              <span className="flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                Actor Network
              </span>
            </TopNavLink>
            <TopNavLink to="/admin/past-events">
              <span className="flex items-center gap-1.5">
                <Archive className="w-4 h-4" />
                Past Events
              </span>
            </TopNavLink>
          </nav>
        </div>

        {/* Right: Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-xs font-medium text-primary">
                  {profile?.organization_name?.[0] || profile?.email?.[0]?.toUpperCase() || "U"}
                </span>
              </div>
              <span className="hidden sm:inline text-sm">
                {profile?.organization_name || profile?.email || "User"}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem className="gap-2">
              <User className="w-4 h-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="gap-2 text-destructive">
              <LogOut className="w-4 h-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

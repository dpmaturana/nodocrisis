import { NavLink, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Activity, BarChart3, Building2, LogOut, MapPin, Plus, Settings, Users, Archive } from "lucide-react";

interface SidebarLinkProps {
  to: string;
  icon: React.ElementType;
  label: string;
}

function SidebarLink({ to, icon: Icon, label }: SidebarLinkProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
          "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          isActive ? "bg-sidebar-accent text-sidebar-primary" : "text-sidebar-foreground",
        )
      }
    >
      <Icon className="w-5 h-5" />
      <span>{label}</span>
    </NavLink>
  );
}

export function AppSidebar() {
  const { isAdmin, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
        <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
          <Activity className="w-6 h-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground">NodoCrisis</h1>
          <p className="text-xs text-muted-foreground">Emergency Coordination</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {isAdmin ? (
          <>
            {/* Admin Navigation */}
            <div className="mb-4">
              <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Operation
              </p>
              <SidebarLink to="/admin/event-dashboard" icon={BarChart3} label="Dashboard" />
              <SidebarLink to="/admin/create-event" icon={Plus} label="Nueva Emergencia" />
            </div>

            <div className="mb-4">
              <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Management
              </p>
              <SidebarLink to="/admin/actors" icon={Users} label="Red de Actores" />
              <SidebarLink to="/admin/past-events" icon={Archive} label="Eventos Pasados" />
            </div>

            <div className="mb-4">
              <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">System</p>
              <SidebarLink to="/admin/settings" icon={Settings} label="Configuración" />
            </div>
          </>
        ) : (
          <>
            {/* Actor Navigation */}
            <div className="mb-4">
              <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">General</p>
              <SidebarLink to="/dashboard" icon={BarChart3} label="Dashboard" />
              <SidebarLink to="/events" icon={Activity} label="Eventos" />
              <SidebarLink to="/sectors" icon={MapPin} label="Sectores" />
            </div>

            <div className="mb-4">
              <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                My Organization
              </p>
              <SidebarLink to="/my-capabilities" icon={Building2} label="Mis Capacidades" />
              <SidebarLink to="/my-deployments" icon={MapPin} label="Mis Despliegues" />
            </div>
          </>
        )}
      </nav>

      {/* User info */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-sm font-medium text-primary">
              {profile?.organization_name?.[0] || profile?.email?.[0]?.toUpperCase() || "U"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{profile?.organization_name || profile?.email || "Usuario"}</p>
            <p className="text-xs text-muted-foreground truncate">{isAdmin ? "Administrador" : "Actor"}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-foreground"
          onClick={handleSignOut}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Log out
        </Button>
      </div>
    </aside>
  );
}

import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { eventService, deploymentService } from "@/services";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CapacityIcon } from "@/components/ui/CapacityIcon";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, AlertTriangle, Building2, ChevronRight, MapPin, Plus, Users } from "@/lib/icons";
import type { Event, CapacityType } from "@/types/database";

interface DashboardData {
  activeEvents: Event[];
  capacityTypes: CapacityType[];
  deploymentCount: number;
  sectorCount: number;
}

export default function Dashboard() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [activeEvents, capacityTypes, deploymentCount] = await Promise.all([
          eventService.getActive(),
          eventService.getCapacityTypes(),
          deploymentService.getActiveCount(),
        ]);

        // Count sectors from active events
        let sectorCount = 0;
        for (const event of activeEvents) {
          const sectors = await eventService.getSectorsForEvent(event.id);
          sectorCount += sectors.length;
        }

        setData({
          activeEvents,
          capacityTypes,
          deploymentCount,
          sectorCount,
        });
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Redirect admins to event dashboard (AFTER all hooks)
  if (!authLoading && isAdmin) {
    return <Navigate to="/admin/event-dashboard" replace />;
  }

  if (authLoading || isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const activeEventCount = data?.activeEvents.length || 0;
  const sectorCount = data?.sectorCount || 0;
  const criticalGaps = 0; // Would be calculated from matrix

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Command center for emergency coordination
          </p>
        </div>
        {isAdmin && (
          <Button asChild>
            <Link to="/admin/create-event">
              <Plus className="w-4 h-4 mr-2" />
              New Event
            </Link>
          </Button>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Events"
          value={activeEventCount}
          subtitle="Ongoing emergencies"
          icon={Activity}
          variant={activeEventCount > 0 ? "warning" : "default"}
        />
        <StatCard
          title="Operational Sectors"
          value={sectorCount}
          subtitle="Areas with activity"
          icon={MapPin}
        />
        <StatCard
          title="Critical Gaps"
          value={criticalGaps}
          subtitle="Uncovered capabilities"
          icon={AlertTriangle}
          variant={criticalGaps > 0 ? "critical" : "success"}
        />
        <StatCard
          title="Active Deployments"
          value={data?.deploymentCount || 0}
          subtitle="Actors in the field"
          icon={Users}
          variant="success"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Events */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Active Events</CardTitle>
              <CardDescription>Ongoing emergencies requiring coordination</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/events">
                View all
                <ChevronRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {data?.activeEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Activity className="w-12 h-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No active events</p>
                {isAdmin && (
                  <Button variant="outline" size="sm" className="mt-4" asChild>
                    <Link to="/admin/create-event">
                      <Plus className="w-4 h-4 mr-2" />
                      Create event
                    </Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {data?.activeEvents.map((event) => (
                  <Link
                    key={event.id}
                    to={isAdmin ? `/admin/event-dashboard/${event.id}` : `/events/${event.id}`}
                    className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center">
                        <Activity className="w-5 h-5 text-warning" />
                      </div>
                      <div>
                        <h3 className="font-semibold group-hover:text-primary transition-colors">
                          {event.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {event.location || "No location defined"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status="warning" label="Active" size="sm" />
                      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Capacity Types */}
        <Card>
          <CardHeader>
            <CardTitle>Capacity Types</CardTitle>
            <CardDescription>Available resources in the system</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data?.capacityTypes.map((capacity) => (
                <div
                  key={capacity.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-accent/30 transition-colors"
                >
                  <CapacityIcon name={capacity.name} icon={capacity.icon} showLabel />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions for Actors */}
      {!isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Manage your participation in emergencies</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
                <Link to="/my-capabilities">
                  <Building2 className="w-6 h-6" />
                  <span>Manage Capabilities</span>
                </Link>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
                <Link to="/sectors">
                  <MapPin className="w-6 h-6" />
                  <span>View Recommended Sectors</span>
                </Link>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
                <Link to="/my-deployments">
                  <Users className="w-6 h-6" />
                  <span>My Deployments</span>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

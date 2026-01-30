import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { capabilityService } from "@/services";
import type { CapabilityWithType } from "@/services/capabilityService";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CapacityIcon } from "@/components/ui/CapacityIcon";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Building2, Plus, Trash2 } from "@/lib/icons";
import type { AvailabilityStatus, CapacityType } from "@/types/database";

export default function MyCapabilities() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [capabilities, setCapabilities] = useState<CapabilityWithType[]>([]);
  const [capacityTypes, setCapacityTypes] = useState<CapacityType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [selectedCapacity, setSelectedCapacity] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [availability, setAvailability] = useState<AvailabilityStatus>("ready");
  const [notes, setNotes] = useState("");

  // Profile form state (read-only in mock)
  const orgName = profile?.organization_name || "";
  const orgType = profile?.organization_type || "";
  const phone = profile?.phone || "";
  const fullName = profile?.full_name || "";

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        const [caps, types] = await Promise.all([
          capabilityService.getByActor(user.id),
          capabilityService.getCapacityTypes(),
        ]);

        setCapabilities(caps);
        setCapacityTypes(types);
      } catch (error) {
        console.error("Error fetching capabilities:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const handleAddCapability = async () => {
    if (!user || !selectedCapacity) return;

    setIsSaving(true);

    try {
      await capabilityService.add({
        user_id: user.id,
        capacity_type_id: selectedCapacity,
        quantity: quantity ? parseInt(quantity) : undefined,
        unit: unit || undefined,
        availability,
        notes: notes || undefined,
      });

      toast({
        title: "Capability added",
        description: "Your capability has been registered successfully.",
      });

      // Reset form
      setSelectedCapacity("");
      setQuantity("");
      setUnit("");
      setAvailability("ready");
      setNotes("");
      setIsDialogOpen(false);

      // Refresh list
      const caps = await capabilityService.getByActor(user.id);
      setCapabilities(caps);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Could not add the capability",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCapability = async (id: string) => {
    try {
      await capabilityService.delete(id);
      setCapabilities(capabilities.filter((c) => c.id !== id));

      toast({
        title: "Capability deleted",
        description: "The capability has been removed from your profile.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Could not delete the capability",
        variant: "destructive",
      });
    }
  };

  const handleUpdateAvailability = async (id: string, newAvailability: AvailabilityStatus) => {
    try {
      await capabilityService.updateAvailability(id, newAvailability);
      setCapabilities(
        capabilities.map((c) => (c.id === id ? { ...c, availability: newAvailability } : c))
      );

      toast({
        title: "Availability updated",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const availableCapacityTypes = capacityTypes.filter(
    (ct) => !capabilities.some((c) => c.capacity_type_id === ct.id)
  );

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Capabilities</h1>
        <p className="text-muted-foreground mt-1">
          Manage the capabilities your organization can provide in emergencies
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Organization Profile */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle>My Organization</CardTitle>
                <CardDescription>Contact information</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Contact name</Label>
              <Input value={fullName} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Organization name</Label>
              <Input value={orgName} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Organization type</Label>
              <Input value={orgType} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={phone} disabled className="bg-muted" />
            </div>
            <p className="text-xs text-muted-foreground">
              (Demo profile - mock data)
            </p>
          </CardContent>
        </Card>

        {/* Capabilities */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Available Capabilities</CardTitle>
              <CardDescription>Resources you can provide</CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button disabled={availableCapacityTypes.length === 0}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Capability
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Capability</DialogTitle>
                  <DialogDescription>
                    Register a capability your organization can provide
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Capability type</Label>
                    <Select value={selectedCapacity} onValueChange={setSelectedCapacity}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select capability" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCapacityTypes.map((ct) => (
                          <SelectItem key={ct.id} value={ct.id}>
                            <div className="flex items-center gap-2">
                              <CapacityIcon name={ct.name} icon={ct.icon} size="sm" />
                              <span className="capitalize">{ct.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Quantity (optional)</Label>
                      <Input
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder="E.g.: 100"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Unit (optional)</Label>
                      <Input
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                        placeholder="E.g.: liters, kits"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Availability</Label>
                    <Select value={availability} onValueChange={(v) => setAvailability(v as AvailabilityStatus)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ready">Available</SelectItem>
                        <SelectItem value="limited">Limited</SelectItem>
                        <SelectItem value="unavailable">Unavailable</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Additional notes</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Additional information about this capability..."
                      rows={3}
                    />
                  </div>

                  <Button onClick={handleAddCapability} className="w-full" disabled={!selectedCapacity || isSaving}>
                    {isSaving ? "Saving..." : "Add Capability"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {capabilities.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>You have no registered capabilities</p>
                <p className="text-sm">Add the capabilities you can provide</p>
              </div>
            ) : (
              <div className="space-y-3">
                {capabilities.map((capability) => (
                  <div
                    key={capability.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <CapacityIcon
                        name={capability.capacity_type?.name || ""}
                        icon={capability.capacity_type?.icon}
                        showLabel
                      />
                      {capability.quantity && (
                        <span className="text-sm text-muted-foreground font-mono">
                          {capability.quantity} {capability.unit || "units"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <Select
                        value={capability.availability}
                        onValueChange={(v) => handleUpdateAvailability(capability.id, v as AvailabilityStatus)}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ready">Available</SelectItem>
                          <SelectItem value="limited">Limited</SelectItem>
                          <SelectItem value="unavailable">Unavailable</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteCapability(capability.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

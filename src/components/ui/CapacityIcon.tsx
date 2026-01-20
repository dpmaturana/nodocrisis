import { cn } from "@/lib/utils";
import { getCapacityIcon } from "@/lib/icons";

interface CapacityIconProps {
  name: string;
  icon?: string | null;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

const sizeConfig = {
  sm: { icon: "w-4 h-4", container: "p-1.5", text: "text-xs" },
  md: { icon: "w-5 h-5", container: "p-2", text: "text-sm" },
  lg: { icon: "w-6 h-6", container: "p-3", text: "text-base" },
};

export function CapacityIcon({
  name,
  icon,
  size = "md",
  showLabel = false,
  className,
}: CapacityIconProps) {
  const IconComponent = getCapacityIcon(icon || name);
  const config = sizeConfig[size];

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          "rounded-lg bg-primary/10 text-primary",
          config.container
        )}
      >
        <IconComponent className={config.icon} />
      </div>
      {showLabel && (
        <span className={cn("font-medium capitalize", config.text)}>
          {name}
        </span>
      )}
    </div>
  );
}

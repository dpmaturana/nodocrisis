import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  variant?: "default" | "critical" | "warning" | "success" | "sms" | "context";
  className?: string;
}

const variantStyles = {
  default: "border-border",
  critical: "border-gap-critical/30 bg-gap-critical/5",
  warning: "border-warning/30 bg-warning/5",
  success: "border-coverage/30 bg-coverage/5",
  sms: "border-demand-sms/30 bg-demand-sms/5",
  context: "border-demand-context/30 bg-demand-context/5",
};

const iconStyles = {
  default: "text-muted-foreground",
  critical: "text-gap-critical",
  warning: "text-warning",
  success: "text-coverage",
  sms: "text-demand-sms",
  context: "text-demand-context",
};

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendValue,
  variant = "default",
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border bg-card p-4 transition-all hover:bg-accent/50",
        variantStyles[variant],
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold font-mono tracking-tight">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
          {trend && trendValue && (
            <p
              className={cn(
                "text-xs font-medium",
                trend === "up" && "text-coverage",
                trend === "down" && "text-gap-critical",
                trend === "neutral" && "text-muted-foreground"
              )}
            >
              {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"} {trendValue}
            </p>
          )}
        </div>
        {Icon && (
          <div className={cn("p-2 rounded-lg bg-muted/50", iconStyles[variant])}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  );
}

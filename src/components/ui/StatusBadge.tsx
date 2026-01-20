import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle, Clock, XCircle } from "@/lib/icons";

type StatusType = "critical" | "warning" | "covered" | "sms" | "context" | "uncovered" | "pending";

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  pulse?: boolean;
  className?: string;
}

const statusConfig: Record<StatusType, { bg: string; text: string; icon: React.ElementType }> = {
  critical: {
    bg: "bg-gap-critical/20",
    text: "text-gap-critical",
    icon: XCircle,
  },
  warning: {
    bg: "bg-warning/20",
    text: "text-warning",
    icon: AlertTriangle,
  },
  covered: {
    bg: "bg-coverage/20",
    text: "text-coverage",
    icon: CheckCircle,
  },
  sms: {
    bg: "bg-demand-sms/20",
    text: "text-demand-sms",
    icon: Clock,
  },
  context: {
    bg: "bg-demand-context/20",
    text: "text-demand-context",
    icon: Clock,
  },
  uncovered: {
    bg: "bg-gap-critical/20",
    text: "text-gap-critical",
    icon: AlertTriangle,
  },
  pending: {
    bg: "bg-muted",
    text: "text-muted-foreground",
    icon: Clock,
  },
};

const sizeConfig = {
  sm: "text-xs px-2 py-0.5 gap-1",
  md: "text-sm px-2.5 py-1 gap-1.5",
  lg: "text-base px-3 py-1.5 gap-2",
};

export function StatusBadge({
  status,
  label,
  size = "md",
  showIcon = true,
  pulse = false,
  className,
}: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded-full border border-current/20",
        config.bg,
        config.text,
        sizeConfig[size],
        pulse && status === "critical" && "pulse-critical",
        className
      )}
    >
      {showIcon && <Icon className={cn(size === "sm" ? "w-3 h-3" : size === "md" ? "w-4 h-4" : "w-5 h-5")} />}
      {label && <span>{label}</span>}
    </span>
  );
}

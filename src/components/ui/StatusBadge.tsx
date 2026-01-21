import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle, Clock, XCircle, Eye, Check, Activity, Pause } from "@/lib/icons";

type StatusType = 
  | "critical" | "warning" | "covered" | "sms" | "context" | "uncovered" | "pending"
  // Gap states (PRD-aligned)
  | "gap-critical" | "gap-partial" | "gap-active" | "gap-evaluating"
  // Deployment states (PRD-aligned)
  | "deploy-interested" | "deploy-confirmed" | "deploy-operating" | "deploy-suspended" | "deploy-finished";

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  pulse?: boolean;
  className?: string;
}

const statusConfig: Record<StatusType, { bg: string; text: string; icon: React.ElementType }> = {
  // Legacy statuses
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
  // Gap states (PRD-aligned)
  "gap-critical": {
    bg: "bg-gap-critical/20",
    text: "text-gap-critical",
    icon: XCircle,
  },
  "gap-partial": {
    bg: "bg-warning/20",
    text: "text-warning",
    icon: AlertTriangle,
  },
  "gap-active": {
    bg: "bg-coverage/20",
    text: "text-coverage",
    icon: CheckCircle,
  },
  "gap-evaluating": {
    bg: "bg-muted",
    text: "text-muted-foreground",
    icon: Clock,
  },
  // Deployment states (PRD-aligned)
  "deploy-interested": {
    bg: "bg-blue-500/20",
    text: "text-blue-400",
    icon: Eye,
  },
  "deploy-confirmed": {
    bg: "bg-yellow-500/20",
    text: "text-yellow-400",
    icon: Check,
  },
  "deploy-operating": {
    bg: "bg-coverage/20",
    text: "text-coverage",
    icon: Activity,
  },
  "deploy-suspended": {
    bg: "bg-muted",
    text: "text-muted-foreground",
    icon: Pause,
  },
  "deploy-finished": {
    bg: "bg-muted/50",
    text: "text-muted-foreground",
    icon: CheckCircle,
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

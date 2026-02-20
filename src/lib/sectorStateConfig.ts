export const SECTOR_STATE_CONFIG = {
  critical: {
    label: "Critical sector",
    icon: "🔴",
    bgClass: "bg-gap-critical/10",
    borderClass: "border-l-4 border-l-gap-critical",
    badgeVariant: "destructive" as const,
    textClass: "text-gap-critical",
  },
  partial: {
    label: "Partial sector",
    icon: "🟠",
    bgClass: "bg-warning/10",
    borderClass: "border-l-4 border-l-warning",
    badgeVariant: "secondary" as const,
    textClass: "text-warning",
  },
  contained: {
    label: "Contained sector",
    icon: "🟢",
    bgClass: "bg-coverage/10",
    borderClass: "border-l-4 border-l-coverage",
    badgeVariant: "outline" as const,
    textClass: "text-coverage",
  },
} as const;

import type { GapState, DeploymentStatus, AppRole } from "@/types/database";
import { AlertCircle, AlertTriangle, CheckCircle, Clock, Eye, Check, Activity, Pause } from "lucide-react";
import { NEED_STATUS_PRESENTATION, mapGapStateToNeedStatus } from "@/lib/needStatus";

// ============= Gap State Transitions =============

const validGapTransitions: Record<GapState, GapState[]> = {
  evaluating: ["critical", "partial", "active"],
  critical: ["partial", "active"], // Cannot go back to evaluating
  partial: ["critical", "active"], // Can escalate or resolve
  active: [], // Terminal state (fully covered)
};

export function canTransitionGap(from: GapState, to: GapState): boolean {
  return validGapTransitions[from]?.includes(to) ?? false;
}

export interface StateConfig {
  bg: string;
  text: string;
  border: string;
  icon: typeof AlertCircle;
  label: string;
}

export function getGapStateConfig(state: GapState): StateConfig {
  const need = mapGapStateToNeedStatus(state);
  const presentation = NEED_STATUS_PRESENTATION[need];

  return {
    bg: presentation.bg,
    text: presentation.text,
    border: presentation.border,
    icon: presentation.icon,
    label: presentation.label,
  };
}

// ============= Deployment State Transitions =============

// Matrix: [fromState][role] -> allowedToStates
const deploymentTransitions: Record<DeploymentStatus, Record<AppRole, DeploymentStatus[]>> = {
  interested: {
    actor: ["confirmed", "finished"], // Actor can confirm or withdraw
    admin: ["confirmed"], // Admin can confirm on behalf
  },
  confirmed: {
    actor: ["operating", "suspended", "finished"],
    admin: ["operating", "suspended", "finished"],
  },
  operating: {
    actor: ["suspended", "finished"],
    admin: ["suspended", "finished"],
  },
  suspended: {
    actor: ["operating", "finished"], // Can resume or finish
    admin: ["operating", "finished"],
  },
  finished: {
    actor: [], // Terminal
    admin: [],
  },
};

export function canTransitionDeployment(from: DeploymentStatus, to: DeploymentStatus, role: AppRole): boolean {
  return deploymentTransitions[from]?.[role]?.includes(to) ?? false;
}

export function getDeploymentStateConfig(status: DeploymentStatus): StateConfig {
  const configs: Record<DeploymentStatus, StateConfig> = {
    interested: {
      bg: "bg-blue-500/20",
      text: "text-blue-400",
      border: "border-blue-500/50",
      icon: Eye,
      label: "Interesado",
    },
    confirmed: {
      bg: "bg-yellow-500/20",
      text: "text-yellow-400",
      border: "border-yellow-500/50",
      icon: Check,
      label: "Confirmado",
    },
    operating: {
      bg: "bg-coverage/20",
      text: "text-coverage",
      border: "border-coverage/50",
      icon: Activity,
      label: "Operando",
    },
    suspended: {
      bg: "bg-muted",
      text: "text-muted-foreground",
      border: "border-muted",
      icon: Pause,
      label: "Suspendido",
    },
    finished: {
      bg: "bg-muted/50",
      text: "text-muted-foreground",
      border: "border-muted/50",
      icon: CheckCircle,
      label: "Finalizado",
    },
  };
  return configs[status];
}

// ============= Event Phase Config =============

export type EventPhase = "stable" | "unstable" | "critical";

export function getEventPhaseConfig(phase: EventPhase): { bg: string; text: string; label: string; emoji: string } {
  const configs: Record<EventPhase, { bg: string; text: string; label: string; emoji: string }> = {
    stable: {
      bg: "bg-coverage/20",
      text: "text-coverage",
      label: "Stabilized",
      emoji: "🟢",
    },
    unstable: {
      bg: "bg-warning/20",
      text: "text-warning",
      label: "Unstable",
      emoji: "🟠",
    },
    critical: {
      bg: "bg-gap-critical/20",
      text: "text-gap-critical",
      label: "Critical",
      emoji: "🔴",
    },
  };
  return configs[phase];
}

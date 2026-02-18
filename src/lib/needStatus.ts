import { AlertCircle, AlertTriangle, CheckCircle2, Clock3, ShieldAlert } from "lucide-react";
import type { GapState } from "@/types/database";

export type NeedStatus = "WHITE" | "RED" | "YELLOW" | "ORANGE" | "GREEN";

export const NEED_STATUS_ORDER: NeedStatus[] = ["RED", "ORANGE", "YELLOW", "GREEN", "WHITE"];

export const NEED_STATUS_TRANSITIONS: Record<NeedStatus, NeedStatus[]> = {
  WHITE: ["RED", "YELLOW", "ORANGE"],
  RED: ["YELLOW", "ORANGE"],
  YELLOW: ["ORANGE", "GREEN", "RED", "WHITE"],
  ORANGE: ["GREEN", "RED", "YELLOW"],
  GREEN: ["YELLOW", "ORANGE", "RED"],
};

export interface NeedStatusPresentation {
  label: string;
  shortLabel: string;
  bg: string;
  text: string;
  border: string;
  dot: string;
  statusBadge: "need-white" | "need-red" | "need-yellow" | "need-orange" | "need-green";
  icon: typeof AlertCircle;
}

export const NEED_STATUS_PRESENTATION: Record<NeedStatus, NeedStatusPresentation> = {
  WHITE: {
    label: "Monitoreo",
    shortLabel: "Blanco",
    bg: "bg-muted/40",
    text: "text-muted-foreground",
    border: "border-muted",
    dot: "bg-muted-foreground",
    statusBadge: "need-white",
    icon: Clock3,
  },
  RED: {
    label: "Crítico sin cobertura",
    shortLabel: "Rojo",
    bg: "bg-gap-critical/20",
    text: "text-gap-critical",
    border: "border-gap-critical/50",
    dot: "bg-gap-critical",
    statusBadge: "need-red",
    icon: AlertCircle,
  },
  ORANGE: {
    label: "Cobertura insuficiente",
    shortLabel: "Naranja",
    bg: "bg-orange-500/20",
    text: "text-orange-400",
    border: "border-orange-500/50",
    dot: "bg-orange-400",
    statusBadge: "need-orange",
    icon: ShieldAlert,
  },
  YELLOW: {
    label: "Cobertura en validación",
    shortLabel: "Amarillo",
    bg: "bg-warning/20",
    text: "text-warning",
    border: "border-warning/50",
    dot: "bg-warning",
    statusBadge: "need-yellow",
    icon: AlertTriangle,
  },
  GREEN: {
    label: "Estabilizado",
    shortLabel: "Verde",
    bg: "bg-coverage/20",
    text: "text-coverage",
    border: "border-coverage/50",
    dot: "bg-coverage",
    statusBadge: "need-green",
    icon: CheckCircle2,
  },
};

const GAP_TO_NEED: Record<GapState, NeedStatus> = {
  evaluating: "WHITE",
  critical: "RED",
  partial: "ORANGE",
  active: "GREEN",
};

export function mapGapStateToNeedStatus(state: GapState): NeedStatus {
  return GAP_TO_NEED[state];
}

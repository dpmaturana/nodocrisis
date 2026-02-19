import type { NeedStatus } from "@/lib/needStatus";

export type NeedCriticalityLevel = "life_threatening" | "high" | "medium" | "low";

export interface SectorNeedInput {
  need_id: string;
  need_status: NeedStatus;
  criticality_level: NeedCriticalityLevel;
  population_weight?: number;
  fragility_alert?: boolean;
}

export interface SectorSeverityConfig {
  severityByStatus: Record<NeedStatus, number>;
  criticalityWeights: Record<NeedCriticalityLevel, number>;
  thresholds: {
    red: number;
    orange: number;
    yellow: number;
    green: number;
  };
  uncertaintyThreshold: number;
  fragilityPenaltyAlpha: number;
  criticalOverride: {
    minStatusForLifeThreateningRed: NeedStatus;
    highOrAboveRedCountForSectorRed: number;
  };
}

export interface SectorNeedContribution {
  need_id: string;
  need_status: NeedStatus;
  criticality_level: NeedCriticalityLevel;
  population_weight: number;
  effective_severity: number;
  contribution: number;
  fragility_alert: boolean;
}

export interface SectorSeverityResult {
  status: NeedStatus;
  score: number;
  score_base: number;
  uncertainty_share: number;
  fragility_share: number;
  high_uncertainty: boolean;
  override_reasons: string[];
  top_contributors: SectorNeedContribution[];
}

export const defaultSectorSeverityConfig: SectorSeverityConfig = {
  severityByStatus: {
    RED: 1,
    ORANGE: 0.7,
    YELLOW: 0.4,
    GREEN: 0.1,
    WHITE: 0,
  },
  criticalityWeights: {
    life_threatening: 3,
    high: 2,
    medium: 1,
    low: 0.5,
  },
  thresholds: {
    red: 0.75,
    orange: 0.55,
    yellow: 0.3,
    green: 0.05,
  },
  uncertaintyThreshold: 0.4,
  fragilityPenaltyAlpha: 0.15,
  criticalOverride: {
    minStatusForLifeThreateningRed: "ORANGE",
    highOrAboveRedCountForSectorRed: 2,
  },
};

const statusRank: Record<NeedStatus, number> = {
  WHITE: 0,
  GREEN: 1,
  YELLOW: 2,
  ORANGE: 3,
  RED: 4,
};

function statusFromScore(score: number, cfg: SectorSeverityConfig): NeedStatus {
  if (score >= cfg.thresholds.red) return "RED";
  if (score >= cfg.thresholds.orange) return "ORANGE";
  if (score >= cfg.thresholds.yellow) return "YELLOW";
  if (score >= cfg.thresholds.green) return "GREEN";
  return "WHITE";
}

export function computeSectorSeverity(
  needs: SectorNeedInput[],
  cfg: SectorSeverityConfig = defaultSectorSeverityConfig,
): SectorSeverityResult {
  if (needs.length === 0) {
    return {
      status: "WHITE",
      score: 0,
      score_base: 0,
      uncertainty_share: 0,
      fragility_share: 0,
      high_uncertainty: false,
      override_reasons: [],
      top_contributors: [],
    };
  }

  let numerator = 0;
  let denominator = 0;
  let yellowWeight = 0;
  let fragilityWeight = 0;
  let highOrAboveRed = 0;
  let hasLifeThreateningRed = false;

  const contributions: SectorNeedContribution[] = needs.map((need) => {
    const popWeight = need.population_weight ?? 1;
    const criticalityWeight = cfg.criticalityWeights[need.criticality_level];
    const weightedDenominator = criticalityWeight * popWeight;

    let effectiveSeverity = cfg.severityByStatus[need.need_status];
    if (need.fragility_alert && need.need_status === "GREEN") {
      effectiveSeverity = Math.max(effectiveSeverity, 0.3);
    }

    const contribution = effectiveSeverity * weightedDenominator;

    numerator += contribution;
    denominator += weightedDenominator;

    if (need.need_status === "YELLOW") yellowWeight += weightedDenominator;
    if (need.fragility_alert) fragilityWeight += weightedDenominator;

    if ((need.criticality_level === "high" || need.criticality_level === "life_threatening") && need.need_status === "RED") {
      highOrAboveRed += 1;
    }
    if (need.criticality_level === "life_threatening" && need.need_status === "RED") {
      hasLifeThreateningRed = true;
    }

    return {
      need_id: need.need_id,
      need_status: need.need_status,
      criticality_level: need.criticality_level,
      population_weight: popWeight,
      effective_severity: effectiveSeverity,
      contribution,
      fragility_alert: need.fragility_alert === true,
    };
  });

  const baseScore = denominator === 0 ? 0 : numerator / denominator;
  const fragilityShare = denominator === 0 ? 0 : fragilityWeight / denominator;
  const adjustedScore = Math.min(1, baseScore + cfg.fragilityPenaltyAlpha * fragilityShare);
  const uncertaintyShare = denominator === 0 ? 0 : yellowWeight / denominator;

  let status = statusFromScore(adjustedScore, cfg);
  const overrideReasons: string[] = [];

  if (hasLifeThreateningRed && statusRank[status] < statusRank[cfg.criticalOverride.minStatusForLifeThreateningRed]) {
    status = cfg.criticalOverride.minStatusForLifeThreateningRed;
    overrideReasons.push("override_life_threatening_red_floor");
  }

  if (highOrAboveRed >= cfg.criticalOverride.highOrAboveRedCountForSectorRed) {
    status = "RED";
    overrideReasons.push("override_multiple_high_red_to_red");
  }

  return {
    status,
    score: adjustedScore,
    score_base: baseScore,
    uncertainty_share: uncertaintyShare,
    fragility_share: fragilityShare,
    high_uncertainty: uncertaintyShare >= cfg.uncertaintyThreshold,
    override_reasons: overrideReasons,
    top_contributors: contributions.sort((a, b) => b.contribution - a.contribution).slice(0, 5),
  };
}

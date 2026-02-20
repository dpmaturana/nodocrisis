import { describe, expect, it } from "vitest";
import {
  type ExtractorInput,
  type ExtractorOutput,
  NeedLevelEngine,
  type NeedEvaluatorInput,
  type NeedEvaluatorOutput,
  type NeedState,
  type NeedsRepository,
  defaultNeedEngineConfig,
} from "@/lib/needLevelEngine";

class InMemoryRepo implements NeedsRepository {
  raw: any[] = [];
  signals: any[] = [];
  needs = new Map<string, NeedState>();
  audits: any[] = [];

  private key(s: string, c: string) {
    return `${s}::${c}`;
  }

  async findRawInputByHash(hash: string) {
    return this.raw.find((r) => r.dedupe_hash === hash) ?? null;
  }

  async insertRawInput(raw: any) {
    const item = { id: `raw-${this.raw.length + 1}`, ...raw };
    this.raw.push(item);
    return item;
  }

  async insertStructuredSignal(signal: any) {
    const item = { id: `sig-${this.signals.length + 1}`, ...signal };
    this.signals.push(item);
    return item;
  }

  async listSignalsForNeed(params: { sector_id: string; capability_id: string; fromInclusive: string; toInclusive: string; }) {
    return this.signals.filter(
      (s) =>
        s.sector_ref.sector_id === params.sector_id &&
        s.capability_ref.capability_id === params.capability_id &&
        s.timestamp >= params.fromInclusive &&
        s.timestamp <= params.toInclusive,
    );
  }

  async getNeedState(sector_id: string, capability_id: string) {
    return this.needs.get(this.key(sector_id, capability_id)) ?? null;
  }

  async upsertNeedState(state: NeedState) {
    this.needs.set(this.key(state.sector_id, state.capability_id), state);
  }

  async appendAudit(audit: any) {
    this.audits.push(audit);
  }
}

class StaticExtractor {
  constructor(private out: ExtractorOutput) {}
  async extract(_: ExtractorInput) {
    return this.out;
  }
}

class StaticEvaluator {
  constructor(private out: NeedEvaluatorOutput) {}
  async evaluate(_: NeedEvaluatorInput) {
    return this.out;
  }
}

const now = "2026-02-16T10:00:00.000Z";
const baseExtractor: ExtractorOutput = {
  sector_ref: { sector_id: "sec-1", confidence: 0.95 },
  capability_ref: { capability_id: "cap-1", confidence: 0.9 },
  source: { reliability: "Institutional" },
  classifications: [
    {
      type: "SIGNAL_DEMAND_INCREASE",
      confidence: 1,
      short_quote: "Demand sharply increased",
    },
  ],
  timestamp: now,
};

const baseEval: NeedEvaluatorOutput = {
  proposed_status: "YELLOW",
  confidence: 0.9,
  reasoning_summary: "coverage uncertain",
  contradiction_detected: false,
  key_evidence: ["raw-1"],
};

describe("NeedLevelEngine", () => {
  it("deduplicates raw input by dedupe_hash", async () => {
    const repo = new InMemoryRepo();
    const engine = new NeedLevelEngine(repo, new StaticExtractor(baseExtractor), new StaticEvaluator(baseEval));

    const payload = {
      source_type: "institutional" as const,
      source_name: "agency",
      timestamp: now,
      text: "same text",
    };

    const first = await engine.processRawInput(payload);
    const second = await engine.processRawInput(payload);

    expect(first.deduped).toBe(false);
    expect(second.deduped).toBe(true);
    expect(repo.raw).toHaveLength(1);
  });

  it("applies RED floor when demand is strong and coverage inactive", async () => {
    const repo = new InMemoryRepo();
    const engine = new NeedLevelEngine(repo, new StaticExtractor(baseExtractor), new StaticEvaluator(baseEval));

    await engine.processRawInput({
      source_type: "institutional",
      source_name: "agency",
      timestamp: now,
      text: "new incident",
    });

    const state = await repo.getNeedState("sec-1", "cap-1");
    expect(state?.current_status).toBe("RED");
  });

  it("blocks GREEN when consecutive stabilization windows are insufficient", async () => {
    const repo = new InMemoryRepo();
    // Start from YELLOW so GREEN is a legal transition and guardrail C can be tested
    repo.needs.set("sec-1::cap-1", {
      sector_id: "sec-1",
      capability_id: "cap-1",
      current_status: "YELLOW",
      demand_score: 0,
      insufficiency_score: 0,
      stabilization_score: 0,
      fragility_score: 0,
      coverage_score: 0,
      stabilization_consecutive_windows: 0,
      last_window_id: null,
      operational_requirements: [],
      fragility_notes: [],
      last_updated_at: now,
      last_status_change_at: now,
    });
    const extractor = new StaticExtractor({
      ...baseExtractor,
      classifications: [{ type: "SIGNAL_STABILIZATION", confidence: 1, short_quote: "improved" }],
    });
    const evaluator = new StaticEvaluator({ ...baseEval, proposed_status: "GREEN" });
    const engine = new NeedLevelEngine(repo, extractor, evaluator);

    await engine.processRawInput({ source_type: "ngo", source_name: "ngo", timestamp: now, text: "one window" });
    const state = await repo.getNeedState("sec-1", "cap-1");
    expect(state?.current_status).toBe("YELLOW");
  });

  it("forces GREEN to YELLOW when fragility alert is active", async () => {
    const repo = new InMemoryRepo();
    repo.needs.set("sec-1::cap-1", {
      sector_id: "sec-1",
      capability_id: "cap-1",
      current_status: "GREEN",
      demand_score: 0,
      insufficiency_score: 0,
      stabilization_score: 0,
      fragility_score: 0,
      coverage_score: 0,
      stabilization_consecutive_windows: 2,
      last_window_id: null,
      operational_requirements: [],
      fragility_notes: [],
      last_updated_at: now,
      last_status_change_at: now,
    });

    const extractor = new StaticExtractor({
      ...baseExtractor,
      classifications: [{ type: "SIGNAL_FRAGILITY_ALERT", confidence: 1, short_quote: "new risk" }],
    });

    const engine = new NeedLevelEngine(repo, extractor, new StaticEvaluator({ ...baseEval, proposed_status: "GREEN" }));

    await engine.processRawInput({ source_type: "twitter", source_name: "news", timestamp: now, text: "risk" });
    const state = await repo.getNeedState("sec-1", "cap-1");
    expect(state?.current_status).toBe("YELLOW");
  });

  it("blocks ORANGE->YELLOW without augmentation evidence", async () => {
    const repo = new InMemoryRepo();
    repo.needs.set("sec-1::cap-1", {
      sector_id: "sec-1",
      capability_id: "cap-1",
      current_status: "ORANGE",
      demand_score: 0,
      insufficiency_score: 0,
      stabilization_score: 0,
      fragility_score: 0,
      coverage_score: 0,
      stabilization_consecutive_windows: 0,
      last_window_id: null,
      operational_requirements: [],
      fragility_notes: [],
      last_updated_at: now,
      last_status_change_at: now,
    });

    const extractor = new StaticExtractor({
      ...baseExtractor,
      classifications: [{ type: "SIGNAL_COVERAGE_ACTIVITY", confidence: 1, short_quote: "coverage", coverage_kind: "baseline" }],
    });

    const engine = new NeedLevelEngine(repo, extractor, new StaticEvaluator({ ...baseEval, proposed_status: "YELLOW" }));

    await engine.processRawInput({ source_type: "ngo", source_name: "ngo", timestamp: now, text: "baseline only" });
    const state = await repo.getNeedState("sec-1", "cap-1");
    expect(state?.current_status).toBe("ORANGE");
  });

  it("keeps previous status when llm confidence is below threshold", async () => {
    const repo = new InMemoryRepo();
    const cfg = { ...defaultNeedEngineConfig, minLlmConfidence: 0.9 };
    const engine = new NeedLevelEngine(
      repo,
      new StaticExtractor({
        ...baseExtractor,
        classifications: [{ type: "SIGNAL_COVERAGE_ACTIVITY", confidence: 1, short_quote: "coverage", coverage_kind: "augmentation" }],
      }),
      new StaticEvaluator({ ...baseEval, proposed_status: "YELLOW", confidence: 0.5 }),
      cfg,
    );

    await engine.processRawInput({ source_type: "ngo", source_name: "ngo", timestamp: now, text: "low llm" });
    const state = await repo.getNeedState("sec-1", "cap-1");
    expect(state?.current_status).toBe("WHITE");
  });

  it("escalates YELLOW to ORANGE when demand is strong (guardrail G)", async () => {
    const repo = new InMemoryRepo();
    // Start from YELLOW (medium)
    repo.needs.set("sec-1::cap-1", {
      sector_id: "sec-1",
      capability_id: "cap-1",
      current_status: "YELLOW",
      demand_score: 0,
      insufficiency_score: 0,
      stabilization_score: 0,
      fragility_score: 0,
      coverage_score: 0,
      stabilization_consecutive_windows: 0,
      last_window_id: null,
      operational_requirements: [],
      fragility_notes: [],
      last_updated_at: now,
      last_status_change_at: now,
    });

    // NGO sends strong demand + coverage present
    const extractor = new StaticExtractor({
      ...baseExtractor,
      classifications: [
        { type: "SIGNAL_DEMAND_INCREASE", confidence: 1, short_quote: "situation worsening" },
        { type: "SIGNAL_COVERAGE_ACTIVITY", confidence: 1, short_quote: "actors present", coverage_kind: "baseline" as const },
      ],
    });

    // Evaluator conservatively proposes YELLOW
    const evaluator = new StaticEvaluator({
      ...baseEval,
      proposed_status: "YELLOW",
      confidence: 0.9,
    });

    const engine = new NeedLevelEngine(repo, extractor, evaluator);

    await engine.processRawInput({
      source_type: "ngo",
      source_name: "ngo-field",
      timestamp: now,
      text: "worsening demand in area",
    });

    const state = await repo.getNeedState("sec-1", "cap-1");
    // Guardrail G should escalate from YELLOW (medium) to ORANGE (high)
    expect(state?.current_status).toBe("ORANGE");
  });

  it("escalates WHITE to ORANGE when demand is strong with coverage (guardrail G)", async () => {
    const repo = new InMemoryRepo();

    // NGO sends strong demand + coverage present (from WHITE start)
    const extractor = new StaticExtractor({
      ...baseExtractor,
      classifications: [
        { type: "SIGNAL_DEMAND_INCREASE", confidence: 1, short_quote: "urgent need" },
        { type: "SIGNAL_COVERAGE_ACTIVITY", confidence: 1, short_quote: "actors on site", coverage_kind: "baseline" as const },
      ],
    });

    // Evaluator conservatively proposes WHITE despite strong demand
    const evaluator = new StaticEvaluator({
      ...baseEval,
      proposed_status: "WHITE",
      confidence: 0.9,
    });

    const engine = new NeedLevelEngine(repo, extractor, evaluator);

    await engine.processRawInput({
      source_type: "ngo",
      source_name: "ngo-field",
      timestamp: now,
      text: "urgent need reported",
    });

    const state = await repo.getNeedState("sec-1", "cap-1");
    // Guardrail G should catch WHITE and escalate to ORANGE
    expect(state?.current_status).toBe("ORANGE");
  });
});

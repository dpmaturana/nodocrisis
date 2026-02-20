import { describe, expect, it } from "vitest";
import {
  NEED_STATUS_TRANSITIONS,
  isValidNeedTransition,
  type NeedStatus,
} from "@/lib/needStatus";
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

// --- helpers (same pattern as needLevelEngine.test.ts) ---

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
  async listSignalsForNeed(params: {
    sector_id: string;
    capability_id: string;
    fromInclusive: string;
    toInclusive: string;
  }) {
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

// ---------- isValidNeedTransition ----------

describe("isValidNeedTransition", () => {
  it("allows staying in the same status", () => {
    const allStatuses: NeedStatus[] = ["WHITE", "RED", "YELLOW", "ORANGE", "GREEN"];
    for (const status of allStatuses) {
      expect(isValidNeedTransition(status, status)).toBe(true);
    }
  });

  it("allows transitions listed in NEED_STATUS_TRANSITIONS", () => {
    for (const [from, targets] of Object.entries(NEED_STATUS_TRANSITIONS)) {
      for (const to of targets) {
        expect(isValidNeedTransition(from as NeedStatus, to)).toBe(true);
      }
    }
  });

  it("rejects transitions not listed in NEED_STATUS_TRANSITIONS", () => {
    // RED cannot go to WHITE or GREEN directly
    expect(isValidNeedTransition("RED", "WHITE")).toBe(false);
    expect(isValidNeedTransition("RED", "GREEN")).toBe(false);
    // WHITE cannot go to GREEN directly
    expect(isValidNeedTransition("WHITE", "GREEN")).toBe(false);
  });
});

// ---------- Engine enforces transitions ----------

describe("NeedLevelEngine transition enforcement", () => {
  it("blocks an illegal transition proposed by the evaluator", async () => {
    const repo = new InMemoryRepo();
    // Start from RED; RED can only go to YELLOW or ORANGE, not GREEN
    repo.needs.set("sec-1::cap-1", {
      sector_id: "sec-1",
      capability_id: "cap-1",
      current_status: "RED",
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
      sector_ref: { sector_id: "sec-1", confidence: 0.95 },
      capability_ref: { capability_id: "cap-1", confidence: 0.9 },
      source: { reliability: "Institutional" },
      classifications: [
        { type: "SIGNAL_STABILIZATION", confidence: 1, short_quote: "stable" },
      ],
      timestamp: now,
    });

    // Evaluator proposes GREEN which is illegal from RED
    const evaluator = new StaticEvaluator({
      proposed_status: "GREEN",
      confidence: 0.9,
      reasoning_summary: "attempt illegal jump",
      contradiction_detected: false,
      key_evidence: ["raw-1"],
    });

    const engine = new NeedLevelEngine(repo, extractor, evaluator);
    await engine.processRawInput({
      source_type: "institutional",
      source_name: "agency",
      timestamp: now,
      text: "stable conditions",
    });

    const state = await repo.getNeedState("sec-1", "cap-1");
    // Should NOT be GREEN because RED->GREEN is not a valid transition
    expect(state?.current_status).not.toBe("GREEN");

    // The audit should record it as an illegal transition
    expect(repo.audits[0]?.legal_transition).toBe(false);
  });

  it("allows a legal transition proposed by the evaluator", async () => {
    const repo = new InMemoryRepo();
    // Start from ORANGE; ORANGE->YELLOW is legal (with augmentation)
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
      sector_ref: { sector_id: "sec-1", confidence: 0.95 },
      capability_ref: { capability_id: "cap-1", confidence: 0.9 },
      source: { reliability: "Institutional" },
      classifications: [
        {
          type: "SIGNAL_COVERAGE_ACTIVITY",
          confidence: 1,
          short_quote: "refuerzo deployed",
          coverage_kind: "augmentation",
        },
      ],
      timestamp: now,
    });

    // Evaluator proposes YELLOW which is legal from ORANGE
    const evaluator = new StaticEvaluator({
      proposed_status: "YELLOW",
      confidence: 0.9,
      reasoning_summary: "coverage improving with augmentation",
      contradiction_detected: false,
      key_evidence: ["raw-1"],
      augmentation_commitment_detected: true,
    });

    const engine = new NeedLevelEngine(repo, extractor, evaluator);
    await engine.processRawInput({
      source_type: "ngo",
      source_name: "ngo",
      timestamp: now,
      text: "augmentation coverage",
    });

    const state = await repo.getNeedState("sec-1", "cap-1");
    expect(state?.current_status).toBe("YELLOW");

    expect(repo.audits[0]?.legal_transition).toBe(true);
  });
});

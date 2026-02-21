import { describe, expect, it } from "vitest";
import {
  NEED_STATUS_TRANSITIONS,
  isValidNeedTransition,
  type NeedStatus,
} from "@/lib/needStatus";

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

// Transition enforcement is now part of the shared evaluateNeedStatus module.
// See src/test/evaluateNeedStatus.test.ts for the guardrail tests.

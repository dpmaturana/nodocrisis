import { describe, it, expect } from "vitest";
import { adjustStatusForCoverage } from "@/services/gapService";

describe("adjustStatusForCoverage", () => {
  describe("without active deployments", () => {
    it("maps critical level to RED", () => {
      const result = adjustStatusForCoverage("critical", 0);
      expect(result.state).toBe("critical");
      expect(result.needStatus).toBe("RED");
    });

    it("maps high level to RED", () => {
      const result = adjustStatusForCoverage("high", 0);
      expect(result.state).toBe("critical");
      expect(result.needStatus).toBe("RED");
    });

    it("maps medium level to ORANGE", () => {
      const result = adjustStatusForCoverage("medium", 0);
      expect(result.state).toBe("partial");
      expect(result.needStatus).toBe("ORANGE");
    });

    it("maps low level to GREEN", () => {
      const result = adjustStatusForCoverage("low", 0);
      expect(result.state).toBe("active");
      expect(result.needStatus).toBe("GREEN");
    });

    it("maps unknown level to WHITE", () => {
      const result = adjustStatusForCoverage("unknown", 0);
      expect(result.state).toBe("evaluating");
      expect(result.needStatus).toBe("WHITE");
    });
  });

  describe("with active deployments (threshold-based)", () => {
    it("keeps critical at RED when coverage is below threshold (3)", () => {
      const result = adjustStatusForCoverage("critical", 1);
      expect(result.state).toBe("critical");
      expect(result.needStatus).toBe("RED");
    });

    it("keeps critical at RED with 2 deployments (still below threshold 3)", () => {
      const result = adjustStatusForCoverage("critical", 2);
      expect(result.state).toBe("critical");
      expect(result.needStatus).toBe("RED");
    });

    it("upgrades critical to GREEN when coverage meets threshold (3)", () => {
      const result = adjustStatusForCoverage("critical", 3);
      expect(result.state).toBe("active");
      expect(result.needStatus).toBe("GREEN");
    });

    it("downgrades high from RED to ORANGE when coverage is below threshold (2)", () => {
      const result = adjustStatusForCoverage("high", 1);
      expect(result.state).toBe("partial");
      expect(result.needStatus).toBe("ORANGE");
    });

    it("upgrades high to GREEN when coverage meets threshold (2)", () => {
      const result = adjustStatusForCoverage("high", 2);
      expect(result.state).toBe("active");
      expect(result.needStatus).toBe("GREEN");
    });

    it("upgrades medium to GREEN when coverage meets threshold (1)", () => {
      const result = adjustStatusForCoverage("medium", 1);
      expect(result.state).toBe("active");
      expect(result.needStatus).toBe("GREEN");
    });

    it("keeps low level at GREEN when coverage exists", () => {
      const result = adjustStatusForCoverage("low", 3);
      expect(result.state).toBe("active");
      expect(result.needStatus).toBe("GREEN");
    });

    it("keeps unknown level at WHITE even with coverage", () => {
      const result = adjustStatusForCoverage("unknown", 1);
      expect(result.state).toBe("evaluating");
      expect(result.needStatus).toBe("WHITE");
    });
  });

  describe("edge cases", () => {
    it("treats negative deployment count same as zero", () => {
      const result = adjustStatusForCoverage("critical", -1);
      expect(result.needStatus).toBe("RED");
    });

    it("critical with many deployments above threshold returns GREEN", () => {
      const result = adjustStatusForCoverage("critical", 10);
      expect(result.needStatus).toBe("GREEN");
    });

    it("high with many deployments above threshold returns GREEN", () => {
      const result = adjustStatusForCoverage("high", 10);
      expect(result.needStatus).toBe("GREEN");
    });
  });
});

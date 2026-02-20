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

  describe("with active deployments meeting demand threshold", () => {
    it("downgrades critical from RED to ORANGE when deployments meet demand (3)", () => {
      const result = adjustStatusForCoverage("critical", 3);
      expect(result.state).toBe("partial");
      expect(result.needStatus).toBe("ORANGE");
    });

    it("downgrades high from RED to ORANGE when deployments meet demand (2)", () => {
      const result = adjustStatusForCoverage("high", 2);
      expect(result.state).toBe("partial");
      expect(result.needStatus).toBe("ORANGE");
    });

    it("downgrades medium from ORANGE to YELLOW when deployments meet demand (1)", () => {
      const result = adjustStatusForCoverage("medium", 1);
      expect(result.state).toBe("partial");
      expect(result.needStatus).toBe("YELLOW");
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

  describe("with partial deployments below demand threshold", () => {
    it("keeps critical at RED when only 1 deployment (demand=3)", () => {
      const result = adjustStatusForCoverage("critical", 1);
      expect(result.state).toBe("critical");
      expect(result.needStatus).toBe("RED");
    });

    it("keeps critical at RED when only 2 deployments (demand=3)", () => {
      const result = adjustStatusForCoverage("critical", 2);
      expect(result.state).toBe("critical");
      expect(result.needStatus).toBe("RED");
    });

    it("keeps high at RED when only 1 deployment (demand=2)", () => {
      const result = adjustStatusForCoverage("high", 1);
      expect(result.state).toBe("critical");
      expect(result.needStatus).toBe("RED");
    });
  });

  describe("edge cases", () => {
    it("treats negative deployment count same as zero", () => {
      const result = adjustStatusForCoverage("critical", -1);
      expect(result.needStatus).toBe("RED");
    });

    it("downgrades critical when deployments exceed demand", () => {
      const result = adjustStatusForCoverage("critical", 10);
      expect(result.needStatus).toBe("ORANGE");
    });

    it("1 deployment is insufficient for critical but sufficient for medium", () => {
      const critical = adjustStatusForCoverage("critical", 1);
      const medium = adjustStatusForCoverage("medium", 1);
      expect(critical.needStatus).toBe("RED");
      expect(medium.needStatus).toBe("YELLOW");
    });
  });
});

import { describe, it, expect } from "vitest";
import { adjustStatusForCoverage } from "@/services/gapService";

describe("adjustStatusForCoverage", () => {
  describe("without active deployments", () => {
    it("maps critical level to RED", () => {
      const result = adjustStatusForCoverage("critical", 0);
      expect(result.state).toBe("critical");
      expect(result.needStatus).toBe("RED");
    });

    it("maps high level to ORANGE", () => {
      const result = adjustStatusForCoverage("high", 0);
      expect(result.state).toBe("partial");
      expect(result.needStatus).toBe("ORANGE");
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

  describe("with active deployments", () => {
    it("downgrades critical from RED to ORANGE when coverage exists", () => {
      const result = adjustStatusForCoverage("critical", 1);
      expect(result.state).toBe("partial");
      expect(result.needStatus).toBe("ORANGE");
    });

    it("keeps high at ORANGE when coverage exists", () => {
      const result = adjustStatusForCoverage("high", 2);
      expect(result.state).toBe("partial");
      expect(result.needStatus).toBe("ORANGE");
    });

    it("downgrades medium from ORANGE to YELLOW when coverage exists", () => {
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

  describe("edge cases", () => {
    it("treats negative deployment count same as zero", () => {
      const result = adjustStatusForCoverage("critical", -1);
      expect(result.needStatus).toBe("RED");
    });

    it("handles multiple deployments same as single for critical", () => {
      const one = adjustStatusForCoverage("critical", 1);
      const ten = adjustStatusForCoverage("critical", 10);
      expect(one.needStatus).toBe(ten.needStatus);
      expect(one.needStatus).toBe("ORANGE");
    });
  });
});

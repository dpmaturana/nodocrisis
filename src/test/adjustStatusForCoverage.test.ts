import { describe, it, expect } from "vitest";
import { adjustStatusForCoverage } from "@/services/gapService";

describe("adjustStatusForCoverage", () => {
  describe("no deployments at all", () => {
    it("maps critical level to RED", () => {
      const result = adjustStatusForCoverage("critical", {});
      expect(result.state).toBe("critical");
      expect(result.needStatus).toBe("RED");
    });

    it("maps high level to RED", () => {
      const result = adjustStatusForCoverage("high", {});
      expect(result.state).toBe("critical");
      expect(result.needStatus).toBe("RED");
    });

    it("maps medium level to ORANGE", () => {
      const result = adjustStatusForCoverage("medium", {});
      expect(result.state).toBe("partial");
      expect(result.needStatus).toBe("ORANGE");
    });

    it("maps low level to GREEN", () => {
      const result = adjustStatusForCoverage("low", {});
      expect(result.state).toBe("active");
      expect(result.needStatus).toBe("GREEN");
    });

    it("maps unknown level to WHITE", () => {
      const result = adjustStatusForCoverage("unknown", {});
      expect(result.state).toBe("evaluating");
      expect(result.needStatus).toBe("WHITE");
    });
  });

  describe("NGO enrolls → interested → YELLOW (coverage being validated)", () => {
    it("downgrades critical from RED to YELLOW", () => {
      const result = adjustStatusForCoverage("critical", { interested: 1 });
      expect(result.state).toBe("partial");
      expect(result.needStatus).toBe("YELLOW");
    });

    it("downgrades high from RED to YELLOW", () => {
      const result = adjustStatusForCoverage("high", { interested: 1 });
      expect(result.state).toBe("partial");
      expect(result.needStatus).toBe("YELLOW");
    });

    it("downgrades medium to YELLOW", () => {
      const result = adjustStatusForCoverage("medium", { interested: 2 });
      expect(result.state).toBe("partial");
      expect(result.needStatus).toBe("YELLOW");
    });

    it("keeps low level at GREEN", () => {
      const result = adjustStatusForCoverage("low", { interested: 1 });
      expect(result.state).toBe("active");
      expect(result.needStatus).toBe("GREEN");
    });

    it("keeps unknown level at WHITE", () => {
      const result = adjustStatusForCoverage("unknown", { interested: 1 });
      expect(result.state).toBe("evaluating");
      expect(result.needStatus).toBe("WHITE");
    });
  });

  describe("admin confirms → confirmed → ORANGE (coverage insufficient)", () => {
    it("downgrades critical from RED to ORANGE", () => {
      const result = adjustStatusForCoverage("critical", { confirmed: 1 });
      expect(result.state).toBe("partial");
      expect(result.needStatus).toBe("ORANGE");
    });

    it("downgrades high from RED to ORANGE", () => {
      const result = adjustStatusForCoverage("high", { confirmed: 2 });
      expect(result.state).toBe("partial");
      expect(result.needStatus).toBe("ORANGE");
    });

    it("downgrades medium from ORANGE to YELLOW", () => {
      const result = adjustStatusForCoverage("medium", { confirmed: 1 });
      expect(result.state).toBe("partial");
      expect(result.needStatus).toBe("YELLOW");
    });

    it("keeps low level at GREEN", () => {
      const result = adjustStatusForCoverage("low", { confirmed: 3 });
      expect(result.state).toBe("active");
      expect(result.needStatus).toBe("GREEN");
    });

    it("keeps unknown level at WHITE", () => {
      const result = adjustStatusForCoverage("unknown", { confirmed: 1 });
      expect(result.state).toBe("evaluating");
      expect(result.needStatus).toBe("WHITE");
    });
  });

  describe("actor operates → operating → GREEN (stabilized)", () => {
    it("upgrades critical to GREEN when operating", () => {
      const result = adjustStatusForCoverage("critical", { operating: 1 });
      expect(result.state).toBe("active");
      expect(result.needStatus).toBe("GREEN");
    });

    it("upgrades high to GREEN when operating", () => {
      const result = adjustStatusForCoverage("high", { operating: 1 });
      expect(result.state).toBe("active");
      expect(result.needStatus).toBe("GREEN");
    });

    it("upgrades medium to GREEN when operating", () => {
      const result = adjustStatusForCoverage("medium", { operating: 1 });
      expect(result.state).toBe("active");
      expect(result.needStatus).toBe("GREEN");
    });

    it("keeps low level at GREEN when operating", () => {
      const result = adjustStatusForCoverage("low", { operating: 1 });
      expect(result.state).toBe("active");
      expect(result.needStatus).toBe("GREEN");
    });

    it("keeps unknown level at WHITE even when operating", () => {
      const result = adjustStatusForCoverage("unknown", { operating: 1 });
      expect(result.state).toBe("evaluating");
      expect(result.needStatus).toBe("WHITE");
    });
  });

  describe("full lifecycle: RED → YELLOW → ORANGE → GREEN", () => {
    it("critical need follows the full color lifecycle", () => {
      const step0 = adjustStatusForCoverage("critical", {});
      expect(step0.needStatus).toBe("RED");

      const step1 = adjustStatusForCoverage("critical", { interested: 1 });
      expect(step1.needStatus).toBe("YELLOW");

      const step2 = adjustStatusForCoverage("critical", { confirmed: 1 });
      expect(step2.needStatus).toBe("ORANGE");

      const step3 = adjustStatusForCoverage("critical", { operating: 1 });
      expect(step3.needStatus).toBe("GREEN");
    });

    it("high need follows the full color lifecycle", () => {
      const step0 = adjustStatusForCoverage("high", {});
      expect(step0.needStatus).toBe("RED");

      const step1 = adjustStatusForCoverage("high", { interested: 1 });
      expect(step1.needStatus).toBe("YELLOW");

      const step2 = adjustStatusForCoverage("high", { confirmed: 1 });
      expect(step2.needStatus).toBe("ORANGE");

      const step3 = adjustStatusForCoverage("high", { operating: 1 });
      expect(step3.needStatus).toBe("GREEN");
    });
  });

  describe("priority: operating > confirmed > interested", () => {
    it("operating takes priority even when interested exists", () => {
      const result = adjustStatusForCoverage("critical", { interested: 3, operating: 1 });
      expect(result.needStatus).toBe("GREEN");
    });

    it("operating takes priority even when confirmed exists", () => {
      const result = adjustStatusForCoverage("critical", { confirmed: 2, operating: 1 });
      expect(result.needStatus).toBe("GREEN");
    });

    it("confirmed takes priority over interested", () => {
      const result = adjustStatusForCoverage("critical", { interested: 3, confirmed: 1 });
      expect(result.needStatus).toBe("ORANGE");
    });

    it("operating takes priority over all for medium", () => {
      const result = adjustStatusForCoverage("medium", { interested: 1, confirmed: 1, operating: 1 });
      expect(result.needStatus).toBe("GREEN");
    });
  });

  describe("edge cases", () => {
    it("treats zero counts same as absent", () => {
      const result = adjustStatusForCoverage("critical", { interested: 0, confirmed: 0, operating: 0 });
      expect(result.needStatus).toBe("RED");
    });

    it("empty counts object means no coverage", () => {
      const result = adjustStatusForCoverage("critical", {});
      expect(result.needStatus).toBe("RED");
    });
  });
});

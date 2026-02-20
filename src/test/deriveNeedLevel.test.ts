import { describe, it, expect } from "vitest";
import { deriveNeedLevel } from "@/lib/deriveNeedLevel";

describe("deriveNeedLevel", () => {
  it("returns 'medium' when items array is empty", () => {
    expect(deriveNeedLevel([])).toBe("medium");
  });

  it("returns the single item's urgency", () => {
    expect(deriveNeedLevel([{ urgency: "low" }])).toBe("low");
    expect(deriveNeedLevel([{ urgency: "high" }])).toBe("high");
    expect(deriveNeedLevel([{ urgency: "critical" }])).toBe("critical");
  });

  it("returns the highest urgency among multiple items", () => {
    expect(
      deriveNeedLevel([
        { urgency: "low" },
        { urgency: "high" },
        { urgency: "medium" },
      ]),
    ).toBe("high");
  });

  it("returns 'critical' when any item is critical", () => {
    expect(
      deriveNeedLevel([
        { urgency: "medium" },
        { urgency: "critical" },
        { urgency: "low" },
      ]),
    ).toBe("critical");
  });

  it("ignores unrecognised urgency values and picks the best recognised one", () => {
    expect(
      deriveNeedLevel([
        { urgency: "unknown_value" },
        { urgency: "low" },
      ]),
    ).toBe("low");
  });

  it("defaults to 'medium' when all urgency values are unrecognised", () => {
    expect(
      deriveNeedLevel([{ urgency: "foo" }, { urgency: "bar" }]),
    ).toBe("medium");
  });
});

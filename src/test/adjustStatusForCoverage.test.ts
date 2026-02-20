import { describe, it, expect } from "vitest";
import { mapNeedLevelToStatus } from "@/services/gapService";

describe("mapNeedLevelToStatus", () => {
  it("maps critical level to RED / critical", () => {
    const result = mapNeedLevelToStatus("critical");
    expect(result.state).toBe("critical");
    expect(result.needStatus).toBe("RED");
  });

  it("maps high level to ORANGE / critical", () => {
    const result = mapNeedLevelToStatus("high");
    expect(result.state).toBe("critical");
    expect(result.needStatus).toBe("ORANGE");
  });

  it("maps medium level to YELLOW / partial", () => {
    const result = mapNeedLevelToStatus("medium");
    expect(result.state).toBe("partial");
    expect(result.needStatus).toBe("YELLOW");
  });

  it("maps low level to GREEN / active", () => {
    const result = mapNeedLevelToStatus("low");
    expect(result.state).toBe("active");
    expect(result.needStatus).toBe("GREEN");
  });

  it("maps unknown level to WHITE / evaluating", () => {
    const result = mapNeedLevelToStatus("unknown");
    expect(result.state).toBe("evaluating");
    expect(result.needStatus).toBe("WHITE");
  });

  it("maps empty string to WHITE / evaluating", () => {
    const result = mapNeedLevelToStatus("");
    expect(result.state).toBe("evaluating");
    expect(result.needStatus).toBe("WHITE");
  });
});

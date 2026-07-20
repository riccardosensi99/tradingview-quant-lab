import { describe, expect, it } from "vitest";
import { computePositionSize, computeRiskReward } from "../scripts/risk/position-sizing.js";

describe("computeRiskReward", () => {
  it("computes R:R to T1 and T2 for a long setup", () => {
    const result = computeRiskReward({ entry: 100, stop: 95, target1: 110, target2: 120 });
    expect(result.riskDistance).toBe(5);
    expect(result.rrToT1).toBe(2);
    expect(result.rrToT2).toBe(4);
  });

  it("computes R:R for a short setup (target below entry)", () => {
    const result = computeRiskReward({ entry: 100, stop: 105, target1: 90 });
    expect(result.rrToT1).toBe(2);
    expect(result.rrToT2).toBeNull();
  });

  it("throws when entry equals stop", () => {
    expect(() => computeRiskReward({ entry: 100, stop: 100, target1: 110 })).toThrow();
  });
});

describe("computePositionSize", () => {
  it("returns nulls when account size is not provided", () => {
    const result = computePositionSize({ riskPerTradePct: 0.5, entry: 100, stop: 95 });
    expect(result.size).toBeNull();
    expect(result.monetaryRisk).toBeNull();
    expect(result.reason).toContain("account-size not provided");
  });

  it("computes size from account size, risk %, and stop distance", () => {
    const result = computePositionSize({ accountSize: 10000, riskPerTradePct: 0.5, entry: 100, stop: 95 });
    expect(result.monetaryRisk).toBe(50); // 0.5% of 10000
    expect(result.size).toBe(10); // 50 / 5 risk distance
  });

  it("throws when entry equals stop", () => {
    expect(() => computePositionSize({ accountSize: 10000, riskPerTradePct: 0.5, entry: 100, stop: 100 })).toThrow();
  });
});

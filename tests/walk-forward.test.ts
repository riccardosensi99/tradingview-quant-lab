import { describe, expect, it } from "vitest";
import { summarizeWalkForward, WalkForwardWindow } from "../scripts/validation/walk-forward.js";

describe("summarizeWalkForward", () => {
  const windows: WalkForwardWindow[] = [
    { label: "2024", period: { from: "2024-01-01", to: "2024-12-31" }, metrics: { net_profit: 100, profit_factor: 1.4 } },
    { label: "2025", period: { from: "2025-01-01", to: "2025-12-31" }, metrics: { net_profit: -20, profit_factor: 0.9 } },
    { label: "2026", period: { from: "2026-01-01", to: "2026-07-20" }, metrics: { net_profit: 50, profit_factor: 1.2 } },
  ];

  it("computes profitable window ratio and worst window", () => {
    const summary = summarizeWalkForward(windows);
    expect(summary.windows).toBe(3);
    expect(summary.profitableWindows).toBe(2);
    expect(summary.profitableWindowRatio).toBeCloseTo(2 / 3);
    expect(summary.worstWindowLabel).toBe("2025");
    expect(summary.profitFactorMean).toBeCloseTo((1.4 + 0.9 + 1.2) / 3);
  });

  it("leaves profitFactor stats null when no window has profit_factor", () => {
    const summary = summarizeWalkForward([{ label: "x", period: { from: "a", to: "b" }, metrics: { net_profit: 1 } }]);
    expect(summary.profitFactorMean).toBeNull();
    expect(summary.profitFactorStdDev).toBeNull();
    expect(summary.worstWindowLabel).toBeNull();
  });

  it("throws on an empty window list", () => {
    expect(() => summarizeWalkForward([])).toThrow();
  });
});

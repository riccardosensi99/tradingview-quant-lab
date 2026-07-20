import { describe, expect, it } from "vitest";
import { compareCostSensitivity } from "../scripts/validation/cost-sensitivity.js";

describe("compareCostSensitivity", () => {
  it("computes deltas between a baseline and a real worsened-cost run", () => {
    const baseline = { profit_factor: 1.4, net_profit: 500 };
    const stressed = { profit_factor: 1.05, net_profit: 80 };
    const result = compareCostSensitivity(baseline, stressed);
    expect(result.profitFactorDelta).toBeCloseTo(-0.35);
    expect(result.profitFactorDeltaPct).toBeCloseTo((-0.35 / 1.4) * 100);
    expect(result.netProfitDelta).toBeCloseTo(-420);
    expect(result.stillProfitable).toBe(true);
  });

  it("flags no longer profitable when stressed net profit turns negative", () => {
    const result = compareCostSensitivity({ profit_factor: 1.4 }, { profit_factor: 0.9, net_profit: -50 });
    expect(result.stillProfitable).toBe(false);
  });

  it("returns nulls when required fields are absent on either side", () => {
    const result = compareCostSensitivity({}, {});
    expect(result.profitFactorDelta).toBeNull();
    expect(result.netProfitDelta).toBeNull();
    expect(result.stillProfitable).toBeNull();
  });
});

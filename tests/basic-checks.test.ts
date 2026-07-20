import { describe, expect, it } from "vitest";
import { runBasicChecks } from "../scripts/research/basic-checks.js";

describe("runBasicChecks", () => {
  it("passes clean, real-shaped metrics", () => {
    const result = runBasicChecks({
      profit_factor: 0.969,
      max_drawdown_pct: 0.478,
      total_trades: 135,
      win_rate_pct: 29.6,
      sharpe_ratio: -2.347,
      sortino_ratio: -0.92,
    });
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("flags a missing total_trades", () => {
    const result = runBasicChecks({ profit_factor: 1.1 });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes("total_trades"))).toBe(true);
  });

  it("flags a non-finite metric", () => {
    const result = runBasicChecks({ total_trades: 10, profit_factor: Infinity });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes("profit_factor"))).toBe(true);
  });

  it("flags an out-of-range win_rate_pct", () => {
    const result = runBasicChecks({ total_trades: 10, win_rate_pct: 150 });
    expect(result.valid).toBe(false);
  });

  it("flags a negative max_drawdown_pct", () => {
    const result = runBasicChecks({ total_trades: 10, max_drawdown_pct: -5 });
    expect(result.valid).toBe(false);
  });
});

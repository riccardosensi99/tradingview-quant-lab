import { describe, expect, it } from "vitest";
import { normalizeStrategyResults } from "../scripts/research/normalize-strategy-results.js";
import { RawStrategyResultsSchema } from "../scripts/adapter/types.js";

describe("normalizeStrategyResults", () => {
  it("maps the 7 verified raw fields to Metrics field names", () => {
    // Values match the real sr-volume-zones capture documented in
    // MCP_CAPABILITIES.md and strategies/registry.yaml.
    const raw = RawStrategyResultsSchema.parse({
      net_profit: -0.059,
      profit_factor: 0.969,
      max_drawdown_percent: 0.478,
      total_trades: 135,
      win_rate: 29.6,
      sharpe: -2.347,
      sortino: -0.92,
    });

    const metrics = normalizeStrategyResults(raw, { symbol: "FX:USDJPY", timeframe: "60" });

    expect(metrics).toEqual({
      symbol: "FX:USDJPY",
      timeframe: "60",
      net_profit: -0.059,
      profit_factor: 0.969,
      max_drawdown_pct: 0.478,
      total_trades: 135,
      win_rate_pct: 29.6,
      sharpe_ratio: -2.347,
      sortino_ratio: -0.92,
    });
  });

  it("leaves unmapped fields absent rather than guessing", () => {
    const raw = RawStrategyResultsSchema.parse({ profit_factor: 1.2 });
    const metrics = normalizeStrategyResults(raw);
    expect(metrics.profit_factor).toBe(1.2);
    expect(metrics.net_profit).toBeUndefined();
    expect(metrics.expectancy).toBeUndefined();
  });
});

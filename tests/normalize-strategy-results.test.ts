import { describe, expect, it } from "vitest";
import { normalizeStrategyResults } from "../scripts/research/normalize-strategy-results.js";
import { RawStrategyResultsSchema } from "../scripts/adapter/types.js";

describe("normalizeStrategyResults", () => {
  it("maps the verified raw fields to Metrics field names, scaling 0-1 fractions to 0-100", () => {
    // Values match the real sr-volume-zones capture on 2026-07-20
    // (FX:USDJPY/60) documented in strategies/registry.yaml.
    const raw = RawStrategyResultsSchema.parse({
      net_profit: -5.921068200000036,
      net_profit_percent: -0.0005921068200000036,
      profit_factor: 0.969026354992589,
      max_drawdown_percent: 0.004781769874421474,
      total_trades: 135,
      percent_profitable: 0.2962962962962963,
      sharpe_ratio: -2.352952197836081,
      sortino_ratio: -0.9203315779840591,
    });

    const metrics = normalizeStrategyResults(raw, { symbol: "FX:USDJPY", timeframe: "60" });

    expect(metrics.symbol).toBe("FX:USDJPY");
    expect(metrics.timeframe).toBe("60");
    expect(metrics.net_profit).toBeCloseTo(-5.921068200000036);
    expect(metrics.net_profit_pct).toBeCloseTo(-0.05921068200000036);
    expect(metrics.profit_factor).toBeCloseTo(0.969026354992589);
    expect(metrics.max_drawdown_pct).toBeCloseTo(0.4781769874421474);
    expect(metrics.total_trades).toBe(135);
    expect(metrics.win_rate_pct).toBeCloseTo(29.62962962962963);
    expect(metrics.sharpe_ratio).toBeCloseTo(-2.352952197836081);
    expect(metrics.sortino_ratio).toBeCloseTo(-0.9203315779840591);
  });

  it("leaves unmapped fields absent rather than guessing", () => {
    const raw = RawStrategyResultsSchema.parse({ profit_factor: 1.2 });
    const metrics = normalizeStrategyResults(raw);
    expect(metrics.profit_factor).toBe(1.2);
    expect(metrics.net_profit).toBeUndefined();
    expect(metrics.expectancy).toBeUndefined();
  });
});

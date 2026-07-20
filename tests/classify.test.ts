import { describe, expect, it } from "vitest";
import { classifyStrategy } from "../scripts/validation/classify.js";
import type { StrategyRegistryEntry } from "../scripts/schemas/registry.js";
import type { ValidationConfig } from "../scripts/schemas/config.js";

const baseEntry: StrategyRegistryEntry = {
  id: "test-strategy",
  name: "Test Strategy",
  pine_script_id: "USER;test",
  status: "experimental",
  stage: "backtest",
  symbol_universe: ["FX:EURUSD"],
  timeframe: "60",
  created: "2026-01-01",
  last_updated: "2026-01-01",
  metrics: {
    net_profit_pct: 1,
    profit_factor: 1,
    max_drawdown_pct: 1,
    sharpe_ratio: 1,
    sortino_ratio: 1,
    total_trades: 10,
    win_rate_pct: 50,
  },
  reports: { backtests: [], validations: [], ideas: [] },
};

const permissiveConfig: ValidationConfig = {
  walk_forward: { in_sample_periods: null, out_of_sample_periods: null },
  monte_carlo: { simulations: null },
  thresholds: { min_sharpe: null, max_drawdown_pct: null, min_trades: null, min_profit_factor: null },
  minimum_out_of_sample_profit_factor: 1.2,
  minimum_total_trades: 200,
  require_positive_expectancy: true,
  include_commissions: true,
  include_spread: true,
  include_slippage: true,
  require_walk_forward: false,
  require_monte_carlo: false,
  require_parameter_stability: false,
  require_out_of_sample: true,
  reject_repainting: true,
  reject_lookahead_bias: true,
};

describe("classifyStrategy", () => {
  it("returns needs_more_data when out-of-sample results are required but absent", () => {
    const result = classifyStrategy(baseEntry, permissiveConfig);
    expect(result.status).toBe("needs_more_data");
  });

  it("returns needs_more_data when walk-forward is required but absent, even with good out-of-sample results", () => {
    const entry: StrategyRegistryEntry = {
      ...baseEntry,
      results: { out_of_sample: { profit_factor: 1.5, total_trades: 300, expectancy: 5 } },
    };
    const config: ValidationConfig = { ...permissiveConfig, require_walk_forward: true };
    const result = classifyStrategy(entry, config);
    expect(result.status).toBe("needs_more_data");
  });

  it("returns validated when all configured criteria pass", () => {
    const entry: StrategyRegistryEntry = {
      ...baseEntry,
      results: { out_of_sample: { profit_factor: 1.5, total_trades: 300, expectancy: 5 } },
      costs_included: { commissions: true, spread: true, slippage: true },
    };
    const result = classifyStrategy(entry, permissiveConfig);
    expect(result.status).toBe("validated");
    expect(result.criteria.every((c) => c.passed === true)).toBe(true);
  });

  it("returns validation_failed when out-of-sample profit factor is below the configured minimum", () => {
    const entry: StrategyRegistryEntry = {
      ...baseEntry,
      results: { out_of_sample: { profit_factor: 0.969, total_trades: 300, expectancy: 5 } },
      costs_included: { commissions: true, spread: true, slippage: true },
    };
    const result = classifyStrategy(entry, permissiveConfig);
    expect(result.status).toBe("validation_failed");
    expect(result.criteria.find((c) => c.name === "out_of_sample_profit_factor")?.passed).toBe(false);
  });

  it("returns validation_failed when total_trades is below the minimum (real sr-volume-zones case: 135 < 200)", () => {
    const entry: StrategyRegistryEntry = {
      ...baseEntry,
      results: { out_of_sample: { profit_factor: 1.5, total_trades: 135, expectancy: 5 } },
      costs_included: { commissions: true, spread: true, slippage: true },
    };
    const result = classifyStrategy(entry, permissiveConfig);
    expect(result.status).toBe("validation_failed");
  });

  it("rejects unconditionally when repainting is detected, regardless of metrics", () => {
    const entry: StrategyRegistryEntry = {
      ...baseEntry,
      results: { out_of_sample: { profit_factor: 5, total_trades: 1000, expectancy: 50 } },
      costs_included: { commissions: true, spread: true, slippage: true },
    };
    const result = classifyStrategy(entry, permissiveConfig, { repaintingDetected: true });
    expect(result.status).toBe("rejected");
  });

  it("rejects unconditionally when look-ahead bias is detected", () => {
    const result = classifyStrategy(baseEntry, permissiveConfig, { lookaheadBiasDetected: true });
    expect(result.status).toBe("rejected");
  });
});

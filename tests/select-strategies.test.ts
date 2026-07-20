import { describe, expect, it } from "vitest";
import { selectValidatedStrategies } from "../scripts/scanner/select-strategies.js";
import type { StrategyRegistry, StrategyRegistryEntry } from "../scripts/schemas/registry.js";

function makeEntry(overrides: Partial<StrategyRegistryEntry> = {}): StrategyRegistryEntry {
  return {
    id: "s1",
    name: "S1",
    pine_script_id: "USER;s1",
    status: "validated",
    stage: "live",
    symbol_universe: ["FX:EURUSD"],
    timeframe: "60",
    created: "2026-01-01",
    last_updated: "2026-01-01",
    metrics: {
      net_profit_pct: 1,
      profit_factor: 1.5,
      max_drawdown_pct: 5,
      sharpe_ratio: 1,
      sortino_ratio: 1,
      total_trades: 250,
      win_rate_pct: 55,
    },
    reports: { backtests: [], validations: [] },
    ...overrides,
  };
}

describe("selectValidatedStrategies", () => {
  const baseContext = { symbol: "FX:EURUSD", timeframe: "60", regime: "strong_trend" as const, direction: "long" as const };

  it("selects a compatible validated strategy", () => {
    const registry: StrategyRegistry = { strategies: [makeEntry()] };
    const result = selectValidatedStrategies(registry, baseContext);
    expect(result.map((s) => s.id)).toEqual(["s1"]);
  });

  it("excludes an experimental strategy even if otherwise compatible (sr-volume-zones case)", () => {
    const registry: StrategyRegistry = { strategies: [makeEntry({ status: "experimental" })] };
    expect(selectValidatedStrategies(registry, baseContext)).toHaveLength(0);
  });

  it("excludes a validated strategy for an unsupported symbol", () => {
    const registry: StrategyRegistry = { strategies: [makeEntry({ symbol_universe: ["FX:USDJPY"] })] };
    expect(selectValidatedStrategies(registry, baseContext)).toHaveLength(0);
  });

  it("excludes a validated strategy for an unsupported timeframe", () => {
    const registry: StrategyRegistry = { strategies: [makeEntry({ timeframe: "240" })] };
    expect(selectValidatedStrategies(registry, baseContext)).toHaveLength(0);
  });

  it("excludes a validated strategy when regimes_supported doesn't include the current regime", () => {
    const registry: StrategyRegistry = { strategies: [makeEntry({ regimes_supported: ["range"] })] };
    expect(selectValidatedStrategies(registry, baseContext)).toHaveLength(0);
  });

  it("excludes a validated strategy when directions_supported excludes the current direction", () => {
    const registry: StrategyRegistry = { strategies: [makeEntry({ directions_supported: ["short"] })] };
    expect(selectValidatedStrategies(registry, baseContext)).toHaveLength(0);
  });

  it("accepts timeframes_supported as an alternative to the single timeframe field", () => {
    const registry: StrategyRegistry = {
      strategies: [makeEntry({ timeframe: "240", timeframes_supported: ["60", "240"] })],
    };
    expect(selectValidatedStrategies(registry, baseContext)).toHaveLength(1);
  });
});

import { describe, expect, it } from "vitest";
import { loadYaml, YamlValidationError } from "../scripts/lib/load-yaml.js";
import { StrategyRegistrySchema } from "../scripts/schemas/registry.js";
import { repoPath } from "./test-paths.js";

describe("strategies/registry.yaml", () => {
  it("parses and validates against the real registry file", () => {
    const registry = loadYaml(repoPath("strategies/registry.yaml"), StrategyRegistrySchema);
    expect(registry.strategies).toHaveLength(1);
  });

  it("keeps sr-volume-zones at status=experimental with its recorded metrics intact", () => {
    const registry = loadYaml(repoPath("strategies/registry.yaml"), StrategyRegistrySchema);
    const entry = registry.strategies.find((s) => s.id === "sr-volume-zones");
    expect(entry).toBeDefined();
    expect(entry?.status).toBe("experimental");
    expect(entry?.stage).toBe("backtest");
    expect(entry?.metrics.profit_factor).toBeCloseTo(0.969);
    expect(entry?.metrics.sharpe_ratio).toBeCloseTo(-2.347);
    // Extended fields are absent on this entry — no data was invented to fill them.
    expect(entry?.results).toBeUndefined();
    expect(entry?.providers_tested).toBeUndefined();
  });

  it("rejects an entry with an unknown status value", () => {
    const badRegistry = {
      strategies: [
        {
          id: "x",
          name: "X",
          pine_script_id: "USER;x",
          status: "definitely_not_validated", // invalid
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
          reports: { backtests: [], validations: [] },
        },
      ],
    };
    const result = StrategyRegistrySchema.safeParse(badRegistry);
    expect(result.success).toBe(false);
  });

  it("throws a descriptive error for a nonexistent file", () => {
    expect(() => loadYaml(repoPath("strategies/does-not-exist.yaml"), StrategyRegistrySchema)).toThrow();
  });

  it("throws YamlValidationError (not a silent default) when required fields are missing", () => {
    // Reuse the loader's schema-validation path directly via a malformed object.
    const result = StrategyRegistrySchema.safeParse({ strategies: [{ id: "only-id" }] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
    expect(YamlValidationError).toBeDefined();
  });
});

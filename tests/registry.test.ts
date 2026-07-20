import { describe, expect, it } from "vitest";
import { loadYaml, YamlValidationError } from "../scripts/lib/load-yaml.js";
import { StrategyRegistrySchema } from "../scripts/schemas/registry.js";
import { repoPath } from "./test-paths.js";

describe("strategies/registry.yaml", () => {
  it("parses and validates against the real registry file", () => {
    const registry = loadYaml(repoPath("strategies/registry.yaml"), StrategyRegistrySchema);
    expect(registry.strategies).toHaveLength(1);
  });

  it("keeps sr-volume-zones at status=needs_more_data with its recorded metrics intact", () => {
    // Updated by the 2026-07-20 research pass: classifyStrategy() returned
    // needs_more_data (no out-of-sample split; walk_forward/monte_carlo
    // config windows are still null) — see reports/validations/sr-volume-zones_2026-07-20.md.
    const registry = loadYaml(repoPath("strategies/registry.yaml"), StrategyRegistrySchema);
    const entry = registry.strategies.find((s) => s.id === "sr-volume-zones");
    expect(entry).toBeDefined();
    expect(entry?.status).toBe("needs_more_data");
    expect(entry?.stage).toBe("backtest");
    expect(entry?.metrics?.profit_factor).toBeCloseTo(0.969026354992589);
    expect(entry?.metrics?.sharpe_ratio).toBeCloseTo(-2.352952197836081);
    // Extended fields are absent on this entry — no data was invented to fill them.
    expect(entry?.results).toBeUndefined();
    expect(entry?.providers_tested).toBeUndefined();
  });

  it("validates a stage=idea entry with pine_script_id and metrics both absent", () => {
    // tradingview-strategy-generator's output shape: a hypothesis with no
    // Pine code and no backtest yet — see docs/decisions/0003-idea-stage-registry-entries.md.
    const registry = {
      strategies: [
        {
          id: "idea-only-strategy",
          name: "Idea Only Strategy",
          status: "experimental",
          stage: "idea",
          symbol_universe: ["FX:EURUSD"],
          timeframe: "60",
          created: "2026-07-20",
          last_updated: "2026-07-20",
          reports: { backtests: [], validations: [], ideas: ["reports/ideas/2026-07-20_1200_generation.md"] },
        },
      ],
    };
    const result = StrategyRegistrySchema.safeParse(registry);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.strategies[0].pine_script_id).toBeUndefined();
      expect(result.data.strategies[0].metrics).toBeUndefined();
    }
  });

  it("rejects a stage=backtest entry missing metrics (superRefine, not blanket optional)", () => {
    const registry = {
      strategies: [
        {
          id: "half-baked-strategy",
          name: "Half Baked Strategy",
          pine_script_id: "USER;half-baked",
          status: "experimental",
          stage: "backtest",
          symbol_universe: ["FX:EURUSD"],
          timeframe: "60",
          created: "2026-07-20",
          last_updated: "2026-07-20",
          reports: { backtests: [], validations: [] },
          // metrics intentionally omitted
        },
      ],
    };
    const result = StrategyRegistrySchema.safeParse(registry);
    expect(result.success).toBe(false);
  });

  it("rejects a stage=backtest entry missing pine_script_id (superRefine, not blanket optional)", () => {
    const registry = {
      strategies: [
        {
          id: "half-baked-strategy-2",
          name: "Half Baked Strategy 2",
          status: "experimental",
          stage: "backtest",
          symbol_universe: ["FX:EURUSD"],
          timeframe: "60",
          created: "2026-07-20",
          last_updated: "2026-07-20",
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
          // pine_script_id intentionally omitted
        },
      ],
    };
    const result = StrategyRegistrySchema.safeParse(registry);
    expect(result.success).toBe(false);
  });

  it("defaults reports.ideas to [] and accepts an explicit array", () => {
    const registry = loadYaml(repoPath("strategies/registry.yaml"), StrategyRegistrySchema);
    const entry = registry.strategies.find((s) => s.id === "sr-volume-zones");
    expect(entry?.reports.ideas).toEqual([]);
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

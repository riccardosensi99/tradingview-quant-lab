import { describe, expect, it } from "vitest";
import { analyzeRegistryGaps, OVERREPRESENTATION_SHARE_THRESHOLD } from "../scripts/generation/registry-analysis.js";
import { makeStrategyEntry } from "./scanner-fixtures.js";
import type { StrategyRegistry } from "../scripts/schemas/registry.js";

describe("analyzeRegistryGaps", () => {
  it("handles an empty registry", () => {
    const result = analyzeRegistryGaps({ strategies: [] });
    expect(result.totalStrategies).toBe(0);
    expect(result.overrepresentedFamilies).toEqual([]);
    expect(result.gaps).toContain("empty registry — no coverage data; any well-formed hypothesis is a legitimate first entry");
  });

  it("flags no validated strategies when the registry has none", () => {
    const registry: StrategyRegistry = {
      strategies: [makeStrategyEntry({ id: "a", status: "needs_more_data" }), makeStrategyEntry({ id: "b", status: "experimental" })],
    };
    const result = analyzeRegistryGaps(registry);
    expect(result.byStatus.validated).toBeUndefined();
    expect(result.gaps).toContain("no validated strategies yet — every entry is still experimental/needs_more_data/rejected or earlier");
    expect(result.needsMoreDataIds).toEqual(["a"]);
  });

  it("flags an overrepresented family in a concentrated registry", () => {
    const registry: StrategyRegistry = {
      strategies: [
        makeStrategyEntry({ id: "a", family: "trend_pullback" }),
        makeStrategyEntry({ id: "b", family: "trend_pullback" }),
        makeStrategyEntry({ id: "c", family: "trend_pullback" }),
      ],
    };
    const result = analyzeRegistryGaps(registry);
    expect(result.byFamily.trend_pullback).toBe(3);
    expect(3 / 3).toBeGreaterThan(OVERREPRESENTATION_SHARE_THRESHOLD);
    expect(result.overrepresentedFamilies).toEqual(["trend_pullback"]);
    expect(result.gaps).toContain("family=trend_pullback is overrepresented relative to the rest of the registry");
  });

  it("does not flag overrepresentation for a single-entry family", () => {
    const registry: StrategyRegistry = { strategies: [makeStrategyEntry({ id: "a", family: "trend_pullback" })] };
    const result = analyzeRegistryGaps(registry);
    expect(result.overrepresentedFamilies).toEqual([]);
  });

  it("reports a mixed registry's grouping dimensions without fabricating missing ones", () => {
    const registry: StrategyRegistry = {
      strategies: [
        makeStrategyEntry({
          id: "a",
          status: "validated",
          family: "trend_pullback",
          symbol_universe: ["FX:EURUSD"],
          timeframe: "60",
          regimes_supported: ["strong_trend"],
          directions_supported: ["long"],
          sessions_supported: ["london"],
        }),
        makeStrategyEntry({
          id: "b",
          status: "experimental",
          family: "range_mean_reversion",
          symbol_universe: ["FX:USDJPY"],
          timeframe: "240",
          directions_supported: ["short"],
        }),
      ],
    };
    const result = analyzeRegistryGaps(registry);
    expect(result.byFamily).toEqual({ trend_pullback: 1, range_mean_reversion: 1 });
    expect(result.byMarket).toEqual({ FX: 2 });
    expect(result.byTimeframe).toEqual({ "60": 1, "240": 1 });
    expect(result.byDirection).toEqual({ long: 1, short: 1 });
    expect(result.byRegime.strong_trend).toBe(1);
    expect(result.byRegime.unspecified).toBe(1);
    expect(result.bySession.london).toBe(1);
    expect(result.bySession.unspecified).toBe(1);
    // both directions present, so neither direction gap fires
    expect(result.gaps).not.toContain("no long-direction strategy");
    expect(result.gaps).not.toContain("no short-direction strategy");
  });

  it("flags a missing direction across the whole registry", () => {
    const registry: StrategyRegistry = { strategies: [makeStrategyEntry({ id: "a", directions_supported: ["long"] })] };
    const result = analyzeRegistryGaps(registry);
    expect(result.gaps).toContain("no short-direction strategy");
  });

  it("flags low family diversity when every entry shares one family (and total >= 3)", () => {
    const registry: StrategyRegistry = {
      strategies: [
        makeStrategyEntry({ id: "a", family: "trend_pullback" }),
        makeStrategyEntry({ id: "b", family: "trend_pullback" }),
        makeStrategyEntry({ id: "c", family: "trend_pullback" }),
      ],
    };
    const result = analyzeRegistryGaps(registry);
    expect(result.gaps).toContain("only one distinct family present across the registry — low family diversity");
  });

  it("flags every unrepresented market regime by name", () => {
    const registry: StrategyRegistry = { strategies: [makeStrategyEntry({ id: "a", regimes_supported: ["strong_trend"] })] };
    const result = analyzeRegistryGaps(registry);
    expect(result.gaps).toContain("no strategy targets regime=volatility_compression");
    expect(result.gaps).not.toContain("no strategy targets regime=strong_trend");
  });
});

import { describe, expect, it } from "vitest";
import { inspectRegistryState, assessNeedsMoreData, findLatestReport, STALE_VALIDATION_DAYS } from "../scripts/orchestrator/inspect-state.js";
import { makeRegistry, makeValidationConfig } from "./orchestrator-fixtures.js";

describe("inspectRegistryState", () => {
  it("returns all-zero counts for an empty registry", () => {
    const state = inspectRegistryState(makeRegistry([]), "2026-07-20");
    expect(state.totalStrategies).toBe(0);
    expect(state.counts.validated).toBe(0);
  });

  it("counts strategies per status", () => {
    const registry = makeRegistry([
      { id: "a", status: "experimental" },
      { id: "b", status: "validation_pending" },
      { id: "c", status: "needs_more_data" },
      { id: "d", status: "validated" },
    ]);
    const state = inspectRegistryState(registry, "2026-07-20");
    expect(state.counts).toMatchObject({ experimental: 1, validation_pending: 1, needs_more_data: 1, validated: 1 });
    expect(state.totalStrategies).toBe(4);
  });

  it("flags a strategy without pine_script_id", () => {
    const registry = makeRegistry([{ id: "idea-1", status: "experimental", stage: "idea", pine_script_id: undefined, metrics: undefined }]);
    const state = inspectRegistryState(registry, "2026-07-20");
    expect(state.withoutPine).toEqual(["idea-1"]);
  });

  it("flags a strategy with pine but no backtest report", () => {
    const registry = makeRegistry([{ id: "s1", reports: { backtests: [], validations: [], ideas: [] } }]);
    const state = inspectRegistryState(registry, "2026-07-20");
    expect(state.withPineNoBacktest).toEqual(["s1"]);
  });

  it("flags a strategy with a backtest but no out-of-sample evidence", () => {
    const registry = makeRegistry([{ id: "s1", reports: { backtests: ["reports/backtests/s1.md"], validations: [], ideas: [] } }]);
    const state = inspectRegistryState(registry, "2026-07-20");
    expect(state.withBacktestNoOutOfSample).toEqual(["s1"]);
  });

  it("does not flag a strategy that has out-of-sample results", () => {
    const registry = makeRegistry([
      {
        id: "s1",
        reports: { backtests: ["reports/backtests/s1.md"], validations: [], ideas: [] },
        results: { out_of_sample: { total_trades: 200 } },
      },
    ]);
    const state = inspectRegistryState(registry, "2026-07-20");
    expect(state.withBacktestNoOutOfSample).toEqual([]);
  });

  it("flags a validated strategy as potentially stale past STALE_VALIDATION_DAYS", () => {
    const registry = makeRegistry([{ id: "s1", status: "validated", last_validated: "2026-01-01" }]);
    // Pure UTC millisecond arithmetic — avoids local-timezone DST drift that
    // Date#setDate (local time) would introduce around a 90-day span.
    const asOfMs = Date.parse("2026-01-01T00:00:00Z") + STALE_VALIDATION_DAYS * 24 * 60 * 60 * 1000;
    const state = inspectRegistryState(registry, new Date(asOfMs).toISOString());
    expect(state.validatedPotentiallyStale).toEqual(["s1"]);
  });

  it("does not flag a recently validated strategy as stale", () => {
    const registry = makeRegistry([{ id: "s1", status: "validated", last_validated: "2026-07-19" }]);
    const state = inspectRegistryState(registry, "2026-07-20");
    expect(state.validatedPotentiallyStale).toEqual([]);
  });

  it("flags an experimental (non-idea) strategy with Pine but no backtest as approved-not-backtested", () => {
    const registry = makeRegistry([
      { id: "s1", status: "experimental", stage: "backtest", pine_script_id: "USER;s1", reports: { backtests: [], validations: [], ideas: [] } },
    ]);
    const state = inspectRegistryState(registry, "2026-07-20");
    expect(state.experimentalApprovedNotBacktested).toEqual(["s1"]);
  });

  it("does not flag an idea-stage experimental entry as approved-not-backtested", () => {
    const registry = makeRegistry([
      { id: "idea-1", status: "experimental", stage: "idea", pine_script_id: undefined, metrics: undefined, reports: { backtests: [], validations: [], ideas: ["reports/ideas/x.md"] } },
    ]);
    const state = inspectRegistryState(registry, "2026-07-20");
    expect(state.experimentalApprovedNotBacktested).toEqual([]);
  });
});

describe("assessNeedsMoreData", () => {
  it("is not resumable while a required config window is still null (this repo's real sr-volume-zones case)", () => {
    const config = makeValidationConfig({
      walk_forward: { in_sample_periods: null, out_of_sample_periods: null },
      monte_carlo: { simulations: null },
    });
    const registry = makeRegistry([{ id: "sr-volume-zones", status: "needs_more_data", metrics: { net_profit_pct: 0, profit_factor: 1, max_drawdown_pct: 1, sharpe_ratio: 0, sortino_ratio: 0, total_trades: 135, win_rate_pct: 30 } }]);
    const assessment = assessNeedsMoreData(registry.strategies[0], config);
    expect(assessment.resumable).toBe(false);
    expect(assessment.hardBlocks.some((b) => b.includes("walk_forward"))).toBe(true);
    expect(assessment.hardBlocks.some((b) => b.includes("total_trades"))).toBe(true);
  });

  it("is resumable once config windows are set and only run-it-again evidence is missing", () => {
    const config = makeValidationConfig();
    const registry = makeRegistry([
      {
        id: "s1",
        status: "needs_more_data",
        metrics: { net_profit_pct: 1, profit_factor: 1.3, max_drawdown_pct: 5, sharpe_ratio: 1, sortino_ratio: 1, total_trades: 250, win_rate_pct: 50 },
      },
    ]);
    const assessment = assessNeedsMoreData(registry.strategies[0], config);
    expect(assessment.resumable).toBe(true);
    expect(assessment.hardBlocks).toEqual([]);
    expect(assessment.resumableGaps.length).toBeGreaterThan(0);
  });

  it("is not resumable when total_trades is below the minimum regardless of config", () => {
    const config = makeValidationConfig();
    const registry = makeRegistry([
      { id: "s1", status: "needs_more_data", metrics: { net_profit_pct: 1, profit_factor: 1.3, max_drawdown_pct: 5, sharpe_ratio: 1, sortino_ratio: 1, total_trades: 50, win_rate_pct: 50 } },
    ]);
    const assessment = assessNeedsMoreData(registry.strategies[0], config);
    expect(assessment.resumable).toBe(false);
  });
});

describe("findLatestReport", () => {
  it("returns null for an empty list", () => {
    expect(findLatestReport([])).toBeNull();
  });

  it("ignores filenames with no embedded date at all", () => {
    expect(findLatestReport([".gitkeep", "README.md"])).toBeNull();
  });

  it("picks the most recent date-prefixed filename (scans convention)", () => {
    const latest = findLatestReport(["2026-07-18_scan.md", "2026-07-20_1932_scan.md", "2026-01-01_scan.md"]);
    expect(latest?.date).toBe("2026-07-20");
    expect(latest?.fileName).toBe("2026-07-20_1932_scan.md");
  });

  it("also matches the date-suffixed filename convention (backtests/validations, e.g. sr-volume-zones_2026-07-20.md)", () => {
    const latest = findLatestReport(["sr-volume-zones_2026-07-20.md", ".gitkeep"]);
    expect(latest).toEqual({ date: "2026-07-20", fileName: "sr-volume-zones_2026-07-20.md" });
  });
});

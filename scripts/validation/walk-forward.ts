// Aggregates walk-forward window results. Each window's Metrics must come
// from a real data_get_strategy_results read over a specific date range
// (set via chart_set_visible_range / chart_scroll_to_date, per
// walk-forward.md) — this module only summarizes windows it's given, it
// never generates or estimates a window's result.

import type { Metrics } from "../schemas/registry.js";

export interface WalkForwardWindow {
  label: string;
  period: { from: string; to: string };
  metrics: Metrics;
}

export interface WalkForwardSummary {
  windows: number;
  profitableWindows: number;
  profitableWindowRatio: number;
  profitFactorMean: number | null;
  profitFactorStdDev: number | null;
  worstWindowLabel: string | null;
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[], m: number): number {
  return Math.sqrt(values.reduce((a, b) => a + (b - m) ** 2, 0) / values.length);
}

export function summarizeWalkForward(windows: WalkForwardWindow[]): WalkForwardSummary {
  if (windows.length === 0) {
    throw new Error("summarizeWalkForward requires at least one real window result");
  }

  const profitableWindows = windows.filter((w) => {
    const profit = w.metrics.net_profit ?? w.metrics.net_profit_pct;
    return profit !== undefined && profit > 0;
  }).length;

  const pfValues = windows
    .filter((w) => w.metrics.profit_factor !== undefined)
    .map((w) => w.metrics.profit_factor as number);

  let worstWindowLabel: string | null = null;
  if (pfValues.length > 0) {
    const worst = windows
      .filter((w) => w.metrics.profit_factor !== undefined)
      .reduce((a, b) => ((b.metrics.profit_factor as number) < (a.metrics.profit_factor as number) ? b : a));
    worstWindowLabel = worst.label;
  }

  const pfMean = pfValues.length > 0 ? mean(pfValues) : null;

  return {
    windows: windows.length,
    profitableWindows,
    profitableWindowRatio: profitableWindows / windows.length,
    profitFactorMean: pfMean,
    profitFactorStdDev: pfValues.length > 0 && pfMean !== null ? stdDev(pfValues, pfMean) : null,
    worstWindowLabel,
  };
}

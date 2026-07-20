// Maps a validated raw data_get_strategy_results payload (see
// scripts/adapter/types.ts) to the Metrics shape used in
// strategies/registry.yaml's `metrics` / `results.*` blocks.
//
// Only fields with a verified raw name are mapped; every Metrics field with
// no confirmed raw source is left absent — never guessed or defaulted to 0.
// A live capture on 2026-07-20 (sr-volume-zones, FX:USDJPY/60) confirmed
// `percent_profitable` and `net_profit_percent` are 0-1 fractions, not 0-100
// percentages — both are ×100'd here to match the registry's existing
// `_pct` convention (e.g. `max_drawdown_pct: 0.478` means 0.478%).

import type { RawStrategyResults } from "../adapter/types.js";
import type { Metrics } from "../schemas/registry.js";

export interface NormalizationContext {
  symbol?: string;
  timeframe?: string;
  periodStart?: string;
  periodEnd?: string;
}

export function normalizeStrategyResults(raw: RawStrategyResults, context: NormalizationContext = {}): Metrics {
  const metrics: Metrics = {};

  if (context.symbol !== undefined) metrics.symbol = context.symbol;
  if (context.timeframe !== undefined) metrics.timeframe = context.timeframe;
  if (context.periodStart !== undefined) metrics.period_start = context.periodStart;
  if (context.periodEnd !== undefined) metrics.period_end = context.periodEnd;

  if (raw.net_profit !== undefined) metrics.net_profit = raw.net_profit;
  if (raw.net_profit_percent !== undefined) metrics.net_profit_pct = raw.net_profit_percent * 100;
  if (raw.profit_factor !== undefined) metrics.profit_factor = raw.profit_factor;
  if (raw.max_drawdown_percent !== undefined) metrics.max_drawdown_pct = raw.max_drawdown_percent * 100;
  if (raw.total_trades !== undefined) metrics.total_trades = raw.total_trades;
  if (raw.percent_profitable !== undefined) metrics.win_rate_pct = raw.percent_profitable * 100;
  if (raw.sharpe_ratio !== undefined) metrics.sharpe_ratio = raw.sharpe_ratio;
  if (raw.sortino_ratio !== undefined) metrics.sortino_ratio = raw.sortino_ratio;

  return metrics;
}

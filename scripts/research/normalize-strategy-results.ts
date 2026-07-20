// Maps a validated raw data_get_strategy_results payload (see
// scripts/adapter/types.ts) to the Metrics shape used in
// strategies/registry.yaml's `metrics` / `results.*` blocks.
//
// Only fields with a verified raw name are mapped; every Metrics field with
// no confirmed raw source is left absent — never guessed or defaulted to 0.
// `win_rate` is assumed to already be a 0-100 percentage (MCP_CAPABILITIES.md
// shows the example value as "29.6%", i.e. the number 29.6), not a 0-1
// fraction — confirm this against a live payload dump before depending on it
// for a real validation decision.

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
  if (raw.profit_factor !== undefined) metrics.profit_factor = raw.profit_factor;
  if (raw.max_drawdown_percent !== undefined) metrics.max_drawdown_pct = raw.max_drawdown_percent;
  if (raw.total_trades !== undefined) metrics.total_trades = raw.total_trades;
  if (raw.win_rate !== undefined) metrics.win_rate_pct = raw.win_rate;
  if (raw.sharpe !== undefined) metrics.sharpe_ratio = raw.sharpe;
  if (raw.sortino !== undefined) metrics.sortino_ratio = raw.sortino;

  return metrics;
}

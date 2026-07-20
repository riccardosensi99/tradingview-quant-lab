// Compares two REAL results — a baseline run and a run with worsened
// costs/spread/slippage actually re-executed in the Strategy Tester — to
// quantify degradation. This module never fabricates the "stressed" run
// itself; both inputs must come from live data_get_strategy_results reads.

import type { Metrics } from "../schemas/registry.js";

export interface CostSensitivityResult {
  profitFactorDelta: number | null;
  profitFactorDeltaPct: number | null;
  netProfitDelta: number | null;
  stillProfitable: boolean | null;
}

export function compareCostSensitivity(baseline: Metrics, stressed: Metrics): CostSensitivityResult {
  const profitFactorDelta =
    baseline.profit_factor !== undefined && stressed.profit_factor !== undefined
      ? stressed.profit_factor - baseline.profit_factor
      : null;

  const profitFactorDeltaPct =
    profitFactorDelta !== null && baseline.profit_factor
      ? (profitFactorDelta / baseline.profit_factor) * 100
      : null;

  const netProfitDelta =
    baseline.net_profit !== undefined && stressed.net_profit !== undefined
      ? stressed.net_profit - baseline.net_profit
      : null;

  let stillProfitable: boolean | null = null;
  if (stressed.net_profit !== undefined) {
    stillProfitable = stressed.net_profit > 0;
  } else if (stressed.net_profit_pct !== undefined) {
    stillProfitable = stressed.net_profit_pct > 0;
  }

  return { profitFactorDelta, profitFactorDeltaPct, netProfitDelta, stillProfitable };
}

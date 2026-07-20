// Flags when a strategy's profit is concentrated in one trade direction —
// "un singolo [...] non deve produrre tutto il profitto" applied to
// long/short balance. Inputs must be real per-direction Metrics.

import type { Metrics } from "../schemas/registry.js";

export interface DirectionBalanceResult {
  longSharePct: number | null;
  shortSharePct: number | null;
  dominantDirection: "long" | "short" | "balanced" | "unknown";
  concentrationWarning: boolean;
}

export interface DirectionBalanceOptions {
  /** Share (0-100) above which a direction is considered dominant. Default 90. */
  concentrationThresholdPct?: number;
}

export function assessDirectionBalance(
  long: Metrics | undefined,
  short: Metrics | undefined,
  options: DirectionBalanceOptions = {},
): DirectionBalanceResult {
  const threshold = options.concentrationThresholdPct ?? 90;
  const longProfit = long?.net_profit;
  const shortProfit = short?.net_profit;

  if (longProfit === undefined || shortProfit === undefined) {
    return { longSharePct: null, shortSharePct: null, dominantDirection: "unknown", concentrationWarning: false };
  }

  const total = longProfit + shortProfit;
  if (total === 0) {
    return { longSharePct: 50, shortSharePct: 50, dominantDirection: "balanced", concentrationWarning: false };
  }

  const longSharePct = (longProfit / total) * 100;
  const shortSharePct = 100 - longSharePct;
  const dominantDirection =
    longSharePct >= threshold ? "long" : shortSharePct >= threshold ? "short" : "balanced";

  return {
    longSharePct,
    shortSharePct,
    dominantDirection,
    concentrationWarning: dominantDirection !== "balanced",
  };
}

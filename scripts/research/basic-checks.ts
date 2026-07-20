// "Controlli base di validità" (research spec, Step C/E) — structural sanity
// checks on a normalized Metrics object. This is NOT the validation engine
// (see scripts/validation/classify.ts for pass/fail against
// config/validation.yaml); it only catches obviously broken data before it's
// written to a report or the registry.

import type { Metrics } from "../schemas/registry.js";

export interface BasicCheckResult {
  valid: boolean;
  issues: string[];
}

export function runBasicChecks(metrics: Metrics): BasicCheckResult {
  const issues: string[] = [];

  if (metrics.total_trades === undefined) {
    issues.push("total_trades is missing — a backtest without a trade count cannot be assessed");
  } else if (metrics.total_trades < 0) {
    issues.push("total_trades is negative");
  }

  for (const [key, value] of Object.entries(metrics)) {
    if (typeof value === "number" && !Number.isFinite(value)) {
      issues.push(`${key} is not a finite number (${value})`);
    }
  }

  if (metrics.profit_factor !== undefined && metrics.profit_factor < 0) {
    issues.push("profit_factor is negative — not a valid ratio");
  }
  if (metrics.max_drawdown_pct !== undefined && metrics.max_drawdown_pct < 0) {
    issues.push("max_drawdown_pct is negative — should be reported as a non-negative magnitude");
  }
  if (metrics.win_rate_pct !== undefined && (metrics.win_rate_pct < 0 || metrics.win_rate_pct > 100)) {
    issues.push("win_rate_pct is outside the [0, 100] range");
  }

  return { valid: issues.length === 0, issues };
}

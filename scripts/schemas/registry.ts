// Zod schema for strategies/registry.yaml.
//
// Extends the existing minimal shape (id, name, pine_script_id, status, stage,
// symbol_universe, timeframe, created, last_updated, metrics, reports, notes)
// with the fuller field set from the research protocol, without breaking the
// entries already committed to the file. All added fields are optional so the
// current `sr-volume-zones` entry — which only has real data for the original
// fields — continues to validate as-is. Do not backfill invented values into
// the new optional fields; leave them absent until a real research pass
// produces the data.

import { z } from "zod";

/** `strategies/registry.yaml`'s `status` enum — see CLAUDE.md / validation-protocol.md.
 * Only `validated` permits use by the market scanner. */
export const StrategyStatusSchema = z.enum([
  "experimental",
  "validation_pending",
  "validated",
  "disabled",
  "rejected",
  "needs_more_data",
  "validation_failed",
]);
export type StrategyStatus = z.infer<typeof StrategyStatusSchema>;

/** `strategies/registry.yaml`'s `stage` enum. */
export const StrategyStageSchema = z.enum([
  "idea",
  "backtest",
  "walk_forward",
  "monte_carlo",
  "paper",
  "live",
]);
export type StrategyStage = z.infer<typeof StrategyStageSchema>;

export const TradeDirectionSchema = z.enum(["long", "short"]);

/** A period boundary, e.g. an in-sample/validation/out-of-sample window. Dates
 * are kept as plain ISO strings (not parsed to Date) so the schema controls
 * parsing explicitly rather than relying on implicit YAML timestamp coercion. */
export const PeriodSchema = z.object({
  from: z.string(),
  to: z.string(),
});
export type Period = z.infer<typeof PeriodSchema>;

/**
 * Backtest/validation result metrics for one run (a stage, a symbol, a year,
 * a regime, a session, a direction, ...). Every field is optional: a given
 * run may only have a subset available (e.g. Sharpe/Sortino are only
 * reportable "quando calcolabili correttamente con i dati disponibili" per
 * the research protocol), and this schema is reused across several contexts
 * that don't all populate the same fields.
 */
export const MetricsSchema = z.object({
  symbol: z.string().optional(),
  provider: z.string().optional(),
  timeframe: z.string().optional(),
  period_start: z.string().optional(),
  period_end: z.string().optional(),
  bar_count: z.number().int().nonnegative().optional(),
  initial_capital: z.number().optional(),
  position_size: z.number().optional(),
  commissions: z.number().optional(),
  spread: z.number().optional(),
  slippage: z.number().optional(),
  total_trades: z.number().int().nonnegative().optional(),
  net_profit: z.number().optional(),
  net_profit_pct: z.number().optional(),
  gross_profit: z.number().optional(),
  gross_loss: z.number().optional(),
  profit_factor: z.number().optional(),
  expectancy: z.number().optional(),
  win_rate_pct: z.number().optional(),
  avg_win: z.number().optional(),
  avg_loss: z.number().optional(),
  payoff_ratio: z.number().optional(),
  max_drawdown_pct: z.number().optional(),
  recovery_factor: z.number().optional(),
  sharpe_ratio: z.number().nullable().optional(),
  sortino_ratio: z.number().nullable().optional(),
  avg_trade_duration: z.string().optional(),
  max_consecutive_wins: z.number().int().nonnegative().optional(),
  max_consecutive_losses: z.number().int().nonnegative().optional(),
});
export type Metrics = z.infer<typeof MetricsSchema>;

/** Legacy single-run metrics block — the shape already used by the
 * `sr-volume-zones` entry. Kept required/as-is for backward compatibility;
 * new entries should prefer `results.{in_sample,validation,out_of_sample}`. */
export const LegacyMetricsSchema = z.object({
  net_profit_pct: z.number(),
  profit_factor: z.number(),
  max_drawdown_pct: z.number(),
  sharpe_ratio: z.number(),
  sortino_ratio: z.number(),
  total_trades: z.number().int().nonnegative(),
  win_rate_pct: z.number(),
});

export const ReportsSchema = z.object({
  backtests: z.array(z.string()).default([]),
  validations: z.array(z.string()).default([]),
});

export const StrategyRegistryEntrySchema = z.object({
  // --- original fields (required, unchanged shape) ---
  id: z.string(),
  name: z.string(),
  pine_script_id: z.string(),
  status: StrategyStatusSchema,
  stage: StrategyStageSchema,
  symbol_universe: z.array(z.string()),
  timeframe: z.string(),
  created: z.string(),
  last_updated: z.string(),
  metrics: LegacyMetricsSchema,
  reports: ReportsSchema,
  notes: z.string().optional(),

  // --- extended fields (all optional — see file header) ---
  description: z.string().optional(),
  version: z.string().optional(),
  providers_tested: z.array(z.string()).optional(),
  timeframes_supported: z.array(z.string()).optional(),
  regimes_supported: z.array(z.string()).optional(),
  directions_supported: z.array(TradeDirectionSchema).optional(),
  parameters: z.record(z.string(), z.unknown()).optional(),
  locked_parameters: z.array(z.string()).optional(),
  last_validated: z.string().optional(),

  periods: z
    .object({
      in_sample: PeriodSchema.optional(),
      validation: PeriodSchema.optional(),
      out_of_sample: PeriodSchema.optional(),
    })
    .optional(),

  results: z
    .object({
      in_sample: MetricsSchema.optional(),
      validation: MetricsSchema.optional(),
      out_of_sample: MetricsSchema.optional(),
    })
    .optional(),

  costs_included: z
    .object({
      commissions: z.boolean(),
      spread: z.boolean(),
      slippage: z.boolean(),
    })
    .optional(),

  results_by_direction: z
    .object({
      long: MetricsSchema.optional(),
      short: MetricsSchema.optional(),
    })
    .optional(),
  results_by_symbol: z.record(z.string(), MetricsSchema).optional(),
  results_by_year: z.record(z.string(), MetricsSchema).optional(),
  results_by_regime: z.record(z.string(), MetricsSchema).optional(),
  results_by_session: z.record(z.string(), MetricsSchema).optional(),

  // Methodology for these three is still TODO (see walk-forward.md,
  // monte-carlo.md) — kept loosely typed until Milestone 3 fixes the shape.
  monte_carlo_results: z.record(z.string(), z.unknown()).optional(),
  walk_forward_results: z.record(z.string(), z.unknown()).optional(),
  parameter_stability: z.record(z.string(), z.unknown()).optional(),

  limitations: z.array(z.string()).optional(),
  risks: z.array(z.string()).optional(),
  invalidation_conditions: z.array(z.string()).optional(),
  pine_script_version: z.string().optional(),
});
export type StrategyRegistryEntry = z.infer<typeof StrategyRegistryEntrySchema>;

export const StrategyRegistrySchema = z.object({
  strategies: z.array(StrategyRegistryEntrySchema),
});
export type StrategyRegistry = z.infer<typeof StrategyRegistrySchema>;

// Zod schemas for the three config/*.yaml files.
//
// Field names and defaults follow the spec's proposed `scanner:`/`risk:`/
// `validation:` blocks. Since this repo already splits config across three
// files (not one combined document), the spec's `filters:` and `reporting:`
// sections — which are scanner-report concerns — live nested inside
// config/scanner.yaml rather than as new top-level files.
//
// Fields marked `.literal(...)` encode hard rules from the spec directly in
// the schema (e.g. martingale is never allowed) so a config edit that
// violates them fails validation instead of silently being accepted.

import { z } from "zod";

export const ScannerConfigSchema = z.object({
  watchlist: z.array(z.string()).default([]),
  timeframes: z.array(z.string()).default([]),
  max_bars_per_symbol: z.number().int().positive(),

  max_results: z.number().int().positive().default(3),
  min_score: z.number().min(0).max(100).default(75),
  mode: z.string().default("conservative"),
  require_closed_bar: z.boolean().default(true),
  reject_stale_data: z.boolean().default(true),

  filters: z
    .object({
      allow_no_trade: z.boolean().default(true),
      require_validated_strategy: z.literal(true).default(true),
      correlation_filter: z.boolean().default(true),
      require_supported_provider: z.boolean().default(true),
      require_supported_timeframe: z.boolean().default(true),
      require_supported_regime: z.boolean().default(true),
      news_check_required: z.boolean().default(false),
      penalize_unverified_news: z.boolean().default(true),
    })
    .default({
      allow_no_trade: true,
      require_validated_strategy: true,
      correlation_filter: true,
      require_supported_provider: true,
      require_supported_timeframe: true,
      require_supported_regime: true,
      news_check_required: false,
      penalize_unverified_news: true,
    }),

  reporting: z
    .object({
      save_markdown: z.boolean().default(true),
      save_json: z.boolean().default(true),
      include_audit_log: z.boolean().default(true),
      include_mcp_tools_used: z.boolean().default(true),
      include_excluded_symbols: z.boolean().default(true),
      include_data_limitations: z.boolean().default(true),
    })
    .default({
      save_markdown: true,
      save_json: true,
      include_audit_log: true,
      include_mcp_tools_used: true,
      include_excluded_symbols: true,
      include_data_limitations: true,
    }),

  regime: z
    .object({
      min_metrics_required: z.number().int().positive().default(3),
      strong_trend_adx_min: z.number().positive().default(25),
      weak_trend_adx_min: z.number().positive().default(15),
      compression_atr_percentile_max: z.number().min(0).max(100).default(20),
      disorder_atr_percentile_min: z.number().min(0).max(100).default(80),
      narrow_bb_width_pct_max: z.number().positive().default(2),
      wide_bb_width_pct_min: z.number().positive().default(6),
      range_efficiency_ratio_max: z.number().min(0).max(1).default(0.3),
      trend_efficiency_ratio_min: z.number().min(0).max(1).default(0.5),
      low_relative_volume_max: z.number().positive().default(0.5),
      conflict_margin_ratio: z.number().min(0).max(1).default(0.15),
    })
    .default({
      min_metrics_required: 3,
      strong_trend_adx_min: 25,
      weak_trend_adx_min: 15,
      compression_atr_percentile_max: 20,
      disorder_atr_percentile_min: 80,
      narrow_bb_width_pct_max: 2,
      wide_bb_width_pct_min: 6,
      range_efficiency_ratio_max: 0.3,
      trend_efficiency_ratio_min: 0.5,
      low_relative_volume_max: 0.5,
      conflict_margin_ratio: 0.15,
    }),
});
export type ScannerConfig = z.infer<typeof ScannerConfigSchema>;

export const RiskConfigSchema = z.object({
  // Original portfolio-level fields (advisory only — see file header comment
  // in config/risk.yaml; no order-execution tool exists to enforce them).
  max_position_size_pct: z.number().nullable().default(null),
  max_concurrent_positions: z.number().int().nullable().default(null),
  max_correlated_exposure_pct: z.number().nullable().default(null),

  // Per-trade / aggregate risk rules from the research + scanner spec.
  risk_per_trade_percent: z.number().positive().default(0.5),
  max_total_risk_percent: z.number().positive().default(1.5),
  minimum_risk_reward: z.number().positive().default(1.8),
  maximum_open_setups: z.number().int().positive().default(3),

  // Hard-forbidden sizing behaviors — schema rejects `true` outright.
  allow_martingale: z.literal(false).default(false),
  allow_averaging_down: z.literal(false).default(false),
  allow_recovery_sizing: z.literal(false).default(false),
});
export type RiskConfig = z.infer<typeof RiskConfigSchema>;

export const ValidationConfigSchema = z.object({
  // Original fields — numeric window/simulation counts, still TODO until a
  // real research pass defines them.
  walk_forward: z
    .object({
      in_sample_periods: z.number().int().positive().nullable().default(null),
      out_of_sample_periods: z.number().int().positive().nullable().default(null),
    })
    .default({ in_sample_periods: null, out_of_sample_periods: null }),
  monte_carlo: z
    .object({
      simulations: z.number().int().positive().nullable().default(null),
    })
    .default({ simulations: null }),
  thresholds: z
    .object({
      min_sharpe: z.number().nullable().default(null),
      max_drawdown_pct: z.number().nullable().default(null),
      min_trades: z.number().int().nullable().default(null),
      min_profit_factor: z.number().nullable().default(null),
    })
    .default({
      min_sharpe: null,
      max_drawdown_pct: null,
      min_trades: null,
      min_profit_factor: null,
    }),

  // Validation criteria from the research spec (section 3's recommended
  // defaults, and section 17's `validation:` block).
  minimum_out_of_sample_profit_factor: z.number().default(1.2),
  minimum_total_trades: z.number().int().positive().default(200),
  require_positive_expectancy: z.boolean().default(true),
  include_commissions: z.boolean().default(true),
  include_spread: z.boolean().default(true),
  include_slippage: z.boolean().default(true),
  require_walk_forward: z.boolean().default(true),
  require_monte_carlo: z.boolean().default(true),
  require_parameter_stability: z.boolean().default(true),
  require_out_of_sample: z.boolean().default(true),

  // Hard-forbidden outcomes — a strategy exhibiting these can never be
  // marked validated, so the schema pins these flags to `true`.
  reject_repainting: z.literal(true).default(true),
  reject_lookahead_bias: z.literal(true).default(true),
});
export type ValidationConfig = z.infer<typeof ValidationConfigSchema>;

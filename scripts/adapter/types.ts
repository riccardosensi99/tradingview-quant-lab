// Zod schemas for raw payloads returned by `tradingview` MCP tools.
//
// Only two tools have field-level shapes actually verified in
// MCP_CAPABILITIES.md: data_get_strategy_results (7 of ~19 named fields —
// "etc." in the source doc means the rest are real but their exact keys were
// never captured) and data_get_trades (id, type, side, price, qty,
// time_index). Both schemas below assert only those verified names and use
// `.catchall(z.unknown())` to pass the remaining real-but-unverified fields
// through without inventing names for them.
//
// The 7 verified field names below were corrected against a real
// data_get_strategy_results capture on 2026-07-20 (sr-volume-zones,
// FX:USDJPY/60): the live payload uses `percent_profitable` (0-1 fraction),
// `sharpe_ratio`, `sortino_ratio`, and `net_profit_percent` (0-1 fraction) —
// not the `win_rate` (0-100)/`sharpe`/`sortino` names originally assumed
// here. See scripts/research/normalize-strategy-results.ts for the ×100
// scaling this implies.
//
// Every other endpoint used by these skills (watchlist_get, symbol_info,
// chart_get_state, data_get_ohlcv summary, data_get_study_values) has no
// field-level detail recorded anywhere in this repo — MCP_CAPABILITIES.md
// only describes them in prose. Asserting specific keys for those here would
// be inventing a schema nobody verified. They get a structural-only check
// (object or array) via UnverifiedPayloadSchema; consuming code must treat
// their fields defensively until a live capture documents them and this
// comment is updated.

import { z } from "zod";

export const RawStrategyResultsSchema = z
  .object({
    net_profit: z.number().optional(),
    net_profit_percent: z.number().optional(),
    profit_factor: z.number().optional(),
    max_drawdown_percent: z.number().optional(),
    total_trades: z.number().optional(),
    percent_profitable: z.number().optional(),
    sharpe_ratio: z.number().optional(),
    sortino_ratio: z.number().optional(),
  })
  .catchall(z.unknown());
export type RawStrategyResults = z.infer<typeof RawStrategyResultsSchema>;

export const RawTradeFillSchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    type: z.string().optional(),
    side: z.string().optional(),
    price: z.number().optional(),
    qty: z.number().optional(),
    time_index: z.number().optional(),
  })
  .catchall(z.unknown());
export type RawTradeFill = z.infer<typeof RawTradeFillSchema>;

export const RawTradesResponseSchema = z.array(RawTradeFillSchema);

/** Structural-only check for tools whose field-level shape is not verified
 * (see file header). Accepts any plain object or array. */
export const UnverifiedPayloadSchema = z.union([
  z.record(z.string(), z.unknown()),
  z.array(z.unknown()),
]);
export type UnverifiedPayload = z.infer<typeof UnverifiedPayloadSchema>;

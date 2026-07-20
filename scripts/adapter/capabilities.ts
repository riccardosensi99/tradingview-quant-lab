// Known capability limits of the `tradingview` MCP server, mirrored from
// MCP_CAPABILITIES.md so calling code can guard against them instead of
// hardcoding magic numbers or discovering the limit at runtime. Re-check
// this file against MCP_CAPABILITIES.md whenever that file is re-verified
// (e.g. after a `tv_update`).

/** data_get_ohlcv hard cap — a tool limit, not a TradingView plan limit. */
export const MAX_OHLCV_BARS_PER_CALL = 500;

/** data_get_ohlcv default bar count when unspecified. */
export const DEFAULT_OHLCV_BARS = 100;

/** data_get_equity does not expose a per-bar equity curve — verified empty
 * `data: []` response. Reconstruct from data_get_trades fills instead. */
export const PER_BAR_EQUITY_CURVE_AVAILABLE = false;

/** data_get_trades' `max_trades` parameter did not reliably cap output in
 * testing (requested 3, got 20). Do not assume it bounds the response size. */
export const TRADES_MAX_TRADES_PARAM_RELIABLE = false;

/** depth_get requires the DOM panel to already be open on the chart. */
export const DEPTH_OF_MARKET_REQUIRES_OPEN_PANEL = true;

/** No tool reports TradingView subscription tier or API rate-limit budget. */
export const PLAN_TIER_EXPOSED_BY_TOOLS = false;

/** data_get_strategy_results / data_get_trades are documented as auto-opening
 * the Strategy Tester panel and auto-unhiding a hidden strategy — not pure
 * reads, despite the name. */
export const STRATEGY_RESULTS_TOOLS_HAVE_UI_SIDE_EFFECTS = true;

# MCP Capabilities — tradingview-mcp

This file records what was **actually verified** against the `tradingview` MCP server (`/home/king/dev/tradingview-mcp`, bridge to TradingView Desktop via Chrome DevTools Protocol), not what the tool descriptions merely claim. Verified on 2026-07-20 via the server's `tv` CLI (same code path as the MCP tools), read-only, against the user's live TradingView Desktop session (`riccardosensi57`, chart `FX:USDJPY` 60m).

Re-verify this file whenever `tradingview-mcp` is updated (`tv_update` bumps `local_commit`) — tool behavior is built on undocumented internal TradingView APIs and can change without notice.

## Connection

- Registered for this project via `.mcp.json` → `node /home/king/dev/tradingview-mcp/src/server.js` (stdio). Requires a Claude Code session restart in this repo to load as native MCP tools; until then it's reachable via `node /home/king/dev/tradingview-mcp/src/cli/index.js <command>`.
- Requires TradingView Desktop running with `--remote-debugging-port=9222`. Confirmed live via `tv_health_check` equivalent (`status`): CDP connected, `api_available: true`.
- 84 tools registered in `src/tools/*.js` (server startup text says "78" — code is newer; trust the source, not the banner).

## Tool inventory and categorization

**Read-only (no known side effects):** `tv_health_check`, `tv_discover`, `tv_ui_state`, `chart_get_state`, `chart_get_visible_range`, `symbol_info`, `symbol_search`, `data_get_ohlcv`, `data_get_indicator`, `quote_get`, `depth_get`, `data_get_pine_lines`, `data_get_pine_labels`, `data_get_pine_tables`, `data_get_pine_boxes`, `data_get_study_values`, `pine_get_source`, `pine_get_errors`, `pine_get_console`, `pine_list_scripts`, `pine_analyze` (offline, no chart needed), `pine_check` (compiles via TradingView server API, not the open chart), `watchlist_get`, `alert_list`, `draw_list`, `draw_get_properties`, `layout_list`, `pane_list`, `tab_list`, `replay_status`, `indicator_search`, `ui_find_element`.

**Potentially mutating (change chart/account state, expected/reversible but not passive reads):** `chart_set_symbol`, `chart_set_timeframe`, `chart_set_type`, `chart_set_visible_range`, `chart_scroll_to_date`, `chart_manage_indicator`, `indicator_set_inputs`, `indicator_toggle_visibility`, `indicator_add`, `watchlist_add`, `watchlist_add_bulk`, `watchlist_remove`, `pine_set_source`, `pine_compile`, `pine_save`, `pine_new`, `pine_open`, `pine_smart_compile`, `draw_shape`, `draw_clear`, `draw_remove_one`, `alert_create`, `alert_delete`, `layout_new`, `layout_switch`, `pane_set_layout`, `pane_focus`, `pane_set_symbol`, `tab_new`, `tab_close`, `tab_switch`, `capture_screenshot` (writes a file to disk), `batch_run` (fans out to other tools — inherits the risk of whatever action it runs), `data_get_strategy_results`, `data_get_trades` (tool descriptions state they auto-open the Strategy Tester panel and auto-unhide a hidden strategy — **not a pure read** despite the name; see verification below).

**Potentially dangerous (avoid unless the user asks for that exact action):** `ui_evaluate` (arbitrary JS execution in the TradingView page context), `ui_click` / `ui_mouse_click` / `ui_keyboard` / `ui_type_text` (blind UI automation — can hit the wrong element and trigger unintended actions), `replay_trade` (executes a trade action, even if only in replay mode), `tv_launch` (kills existing TradingView instances by default), `tv_update` (updates the MCP server via git), `pine_new` / `pine_open` / `pine_set_source` (overwrite the Pine editor — risk of losing unsaved work).

## Verified capabilities (live, read-only)

| Capability | Tool(s) | Result |
|---|---|---|
| Active watchlist + symbols | `watchlist_get` | List "ric", 9 symbols (USDCAD, EURUSD, USDCHF, EURGBP, GBPUSD, USOIL, ...) with live last/change/volume |
| Ticker + provider | `symbol_info`, `watchlist_get` | Confirmed `EXCHANGE:SYMBOL` format; same pair available from multiple feeds (`FX:EURUSD` vs `OANDA:EURUSD`) |
| Symbol open on chart | `chart_get_state` | `FX:USDJPY` |
| Timeframe | `chart_get_state` | `60` (1h) |
| OHLCV data | `data_get_ohlcv --summary` | 100 real bars, OHLC + volume |
| Indicators | `chart_get_state`, `data_get_study_values` | 1 visible study ("SR Volume Zones Strategy") with full input set and Buy/Sell values |
| Pine Editor | `pine_list_scripts`, `pine_get_source` | 7 saved scripts with real titles; source readable (7259 chars for the active one — not printed here, treat Pine source as proprietary/sensitive) |
| Pine-drawn levels | `data_get_pine_lines`, `data_get_pine_labels` | 8 S/R price levels with real price + volume annotations |
| Strategy Tester results | `data_get_strategy_results` | 19 metrics returned: net_profit, profit_factor 0.969, max_drawdown_percent 0.48%, total_trades 135, win_rate 29.6%, sharpe -2.35, sortino -0.92, etc. Ran without an `unhidden_strategies` field in the response, i.e. the strategy was already visible — no observed mutation this time. |
| Simulated trades | `data_get_trades` | Returns individual fill records (id, type, side, entry/exit, price, qty, time_index). `max_trades` param did not appear to cap output as documented — requested 3, got 20 (`total_orders: 255` available) — worth re-checking before relying on it to bound context size. |
| Equity curve | `data_get_equity` | Per-bar equity is **not exposed** — returns empty `data: []` with a note; only a `buy_hold_points` count (136) is available. `data_get_strategy_results` is the source for aggregate P&L. |
| Layouts | `layout_list` | 5 saved layouts with name/symbol/resolution/modified date |
| Alerts | `alert_list` | 0 active (correctly read, not assumed) |
| Drawings | `draw_list` | 28 shapes (rectangles, trendlines, text) |
| Panes / tabs | `pane_list`, `tab_list` | 1 pane, 1 tab — no multi-chart layout active |
| Internal API surface | `tv_discover` | 5/6 known internal API paths available |

## Known gaps / not verified

- **Depth of Market**: `depth_get` returns a clean error — `"DOM / Depth of Market panel not found."` — the DOM panel isn't open on the chart. Capability exists but requires the panel to be opened first (not done, to stay non-invasive).
- **Historical depth**: `data_get_ohlcv` is hard-capped at **500 bars per call** (default 100) — a tool limit, not a TradingView plan limit. How far back real data actually goes for a given symbol/timeframe depends on the user's TradingView subscription tier and is **not exposed by any tool** — check TradingView account settings directly.
- **Plan tier / rate limits**: no tool reports the TradingView subscription tier or any API rate-limit budget. Do not infer or fabricate this — treat as unknown until the user confirms it from their account.

## Data feed / plan limits found in code

- `data_get_ohlcv`: max 500 bars per request (see `src/tools/data.js`)
- `data_get_trades`: `max_trades` parameter present but did not visibly cap results in this test — verify again before depending on it
- Multiple data providers per instrument confirmed (broker-specific feeds, e.g. `FX:` vs `OANDA:` for the same pair) — feed choice affects price/volume, not just the symbol

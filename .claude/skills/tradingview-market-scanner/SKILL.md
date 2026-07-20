---
name: tradingview-market-scanner
description: Use when scanning the active TradingView watchlist (or a configured symbol universe) for trade candidates — e.g. "scansiona il mercato", "trova candidati", "aggiorna la watchlist con setup validi". Reads live chart/watchlist data via the tradingview MCP server and writes a report to reports/scans/.
---

# TradingView Market Scanner

Scans a symbol universe using the `tradingview` MCP server (live TradingView Desktop connection — see [MCP_CAPABILITIES.md](../../../MCP_CAPABILITIES.md) for what's actually verified) and ranks candidates. See [scoring.md](scoring.md), [risk-management.md](risk-management.md), and [output-template.md](output-template.md) — all still TODO on numeric criteria; this file defines the process contract.

## Inputs

- Symbol universe: `watchlist_get` (active TradingView watchlist) by default, or the `watchlist` list in `config/scanner.yaml` if set
- Timeframes: from `config/scanner.yaml` (`timeframes`), default to the chart's current timeframe (`chart_get_state`) if empty

## Process

1. `chart_get_state` once, to capture the symbol/timeframe/study state to restore at the end (this skill must not leave the user's chart on a different symbol than where it started)
2. Resolve the universe: `watchlist_get`, or `config/scanner.yaml` if `watchlist` is non-empty there
3. For each symbol × timeframe: `chart_set_symbol` + `chart_set_timeframe`, then `data_get_ohlcv --summary` and `data_get_study_values` for whatever indicators are already visible on the chart. Prefer `batch_run` where it fits instead of manual iteration.
4. Score each candidate per [scoring.md](scoring.md) and filter per [risk-management.md](risk-management.md)
5. Restore the original symbol/timeframe (`chart_set_symbol`/`chart_set_timeframe` back to the state captured in step 1)
6. Write the report per [output-template.md](output-template.md) to `reports/scans/`

## Hard constraints

- Never call `chart_manage_indicator`, `indicator_add`, `indicator_toggle_visibility`, or `indicator_set_inputs` — this skill reads whatever indicators are already on the chart, it does not add/remove/reconfigure them
- Never call `watchlist_add` / `watchlist_add_bulk` / `watchlist_remove` without explicit user confirmation for that specific change
- Never call anything in the "potentially dangerous" category of `MCP_CAPABILITIES.md` (`ui_evaluate`, `ui_click`/`ui_mouse_click`/`ui_keyboard`/`ui_type_text`, `replay_trade`, `tv_launch`, `tv_update`)
- Always restore the chart's original symbol/timeframe before finishing, even if the scan is interrupted

## Output

Markdown report in `reports/scans/`, filename `<YYYY-MM-DD>_<HHmm>_scan.md`, format per [output-template.md](output-template.md).

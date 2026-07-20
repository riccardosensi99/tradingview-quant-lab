---
name: tradingview-market-scanner
description: Use when scanning the active TradingView watchlist (or a configured symbol universe) for trade candidates — e.g. "scansiona il mercato", "trova candidati", "aggiorna la watchlist con setup validi". Reads live chart/watchlist data via the tradingview MCP server and writes a report to reports/scans/.
---

# TradingView Market Scanner

Scans a symbol universe using the `tradingview` MCP server (live TradingView Desktop connection — see [MCP_CAPABILITIES.md](../../../MCP_CAPABILITIES.md) for what's actually verified) and ranks candidates. The scoring, risk, regime, and correlation logic this skill runs on is implemented and tested in `scripts/scoring/`, `scripts/risk/`, `scripts/regime/`, and `scripts/scanner/` — see [scoring.md](scoring.md), [risk-management.md](risk-management.md), and [output-template.md](output-template.md) for what each of those does, and [STEERING.md](../../../STEERING.md) for the full architecture. This file defines the process contract: what the agent does live, in what order, against which MCP tools.

## Inputs

- Symbol universe: `watchlist_get` (active TradingView watchlist) by default, or the `watchlist` list in `config/scanner.yaml` if set
- Timeframes: from `config/scanner.yaml` (`timeframes`), default to the chart's current timeframe (`chart_get_state`) if empty

## Process

1. `chart_get_state` once, to capture the symbol/timeframe/study state to restore at the end (this skill must not leave the user's chart on a different symbol than where it started)
2. Resolve the universe: `watchlist_get`, or `config/scanner.yaml` if `watchlist` is non-empty there
3. For each symbol × timeframe: `chart_set_symbol` + `chart_set_timeframe`, then `data_get_ohlcv --summary` and `data_get_study_values` for whatever indicators are already visible on the chart. Prefer `batch_run` where it fits instead of manual iteration. Read `strategies/registry.yaml` and keep only `status: validated` entries compatible with the symbol/timeframe/regime/direction (`scripts/scanner/select-strategies.ts`) — if none exist, this pass is descriptive analysis only, per [scoring.md](scoring.md)'s exclusion rules.
4. Classify the regime (`scripts/regime/classify-regime.ts`) from whatever metrics are actually available from step 3, score each candidate (`scripts/scoring/`) per [scoring.md](scoring.md), and size/filter it (`scripts/risk/`) per [risk-management.md](risk-management.md). None of this code calls MCP tools itself — feed it the data already read in step 3.
5. Assemble the scan (`scripts/scanner/assemble-scan-input.ts` → `run-scan.ts`): correlation filtering, aggregate-risk capping, ranking, NO TRADE if nothing survives.
6. Restore the original symbol/timeframe (`chart_set_symbol`/`chart_set_timeframe` back to the state captured in step 1)
7. Write the report (`scripts/scanner/report-markdown.ts` / `report-json.ts`) per [output-template.md](output-template.md) to `reports/scans/`

## Hard constraints

Full rationale and which of these are also enforced in code: [STEERING.md §8-9](../../../STEERING.md#8-regole-mcp). Summary for this skill specifically:

- Never call `chart_manage_indicator`, `indicator_add`, `indicator_toggle_visibility`, or `indicator_set_inputs` — this skill reads whatever indicators are already on the chart, it does not add/remove/reconfigure them
- Never call `watchlist_add` / `watchlist_add_bulk` / `watchlist_remove` without explicit user confirmation for that specific change
- Never call anything in the "potentially dangerous" category of `MCP_CAPABILITIES.md` (`ui_evaluate`, `ui_click`/`ui_mouse_click`/`ui_keyboard`/`ui_type_text`, `replay_trade`, `tv_launch`, `tv_update`)
- Always restore the chart's original symbol/timeframe before finishing, even if the scan is interrupted

## Output

Markdown report in `reports/scans/`, filename `<YYYY-MM-DD>_<HHmm>_scan.md`, format per [output-template.md](output-template.md). JSON report alongside it per `config/scanner.yaml`'s `reporting.save_json`.

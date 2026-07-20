# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A quant trading lab built around two Claude Code skills: scanning TradingView markets for candidates, and researching/validating trading strategies (Pine Script) before they go live. The repo is currently scaffolded — most config and skill docs are TODO placeholders (numeric criteria/thresholds), but the MCP connection and skill contracts are real and verified.

## MCP connection

Both skills operate through the `tradingview` MCP server (`.mcp.json` → `node /home/king/dev/tradingview-mcp/src/server.js`, a separate sibling repo — a live bridge to TradingView Desktop via Chrome DevTools Protocol). Requires TradingView Desktop running locally with `--remote-debugging-port=9222` and a session restart in this repo to pick up `.mcp.json`.

`MCP_CAPABILITIES.md` is the source of truth for what's actually verified against this server — tool inventory, read-only vs. mutating vs. dangerous categorization, and known gaps (e.g. no per-bar equity curve, `data_get_ohlcv` capped at 500 bars, TradingView plan/historical-depth limits aren't exposed by any tool). Re-read it, don't assume a capability exists — the server wraps undocumented internal TradingView APIs that can change without notice, and re-verify after any `tv_update`.

**Hard constraints for both skills** (see each SKILL.md for the full rationale):
- Never call `ui_evaluate`, `ui_click`/`ui_mouse_click`/`ui_keyboard`/`ui_type_text`, `replay_trade`, `tv_launch`, or `tv_update` as part of normal skill operation
- Never call `pine_set_source`/`pine_save`/`pine_new`/`pine_open` without explicit per-call user confirmation (overwrites the live Pine editor)
- Never call `chart_manage_indicator`/`indicator_add`/`indicator_toggle_visibility`/`indicator_set_inputs`, `watchlist_add`/`watchlist_remove`, `alert_create`/`alert_delete`, or `layout_new`/`layout_switch` without explicit user confirmation for that specific change
- `data_get_strategy_results`/`data_get_trades` are read tools with a documented side effect (auto-open Strategy Tester panel, auto-unhide a hidden strategy) — not neutral reads, confirm before the first call on an unfamiliar strategy
- Any skill that changes the chart's symbol/timeframe must restore the original state before finishing

## Commands

Stack is Node/TypeScript.

- `npm install` — install dependencies
- `npm run build` — compile `scripts/` and `tests/` via `tsc` (see `tsconfig.json`)
- `npm test` — not wired up yet (no test runner configured)

Copy `.env.example` to `.env` and fill in credentials before running any scripts that hit external data providers.

## Architecture

The repo is organized around two Claude Code skills (`.claude/skills/`), each with its own supporting docs that the SKILL.md files link out to:

- **`tradingview-market-scanner`** — scans markets/instruments for trade candidates.
  - `scoring.md` — how candidates are scored/ranked
  - `risk-management.md` — position sizing and portfolio-level risk filters (backed by `config/risk.yaml`)
  - `output-template.md` — required format for scan output written to `reports/scans/`
  - Configured via `config/scanner.yaml` (watchlist, timeframes)

- **`tradingview-strategy-research`** — takes a strategy from idea to validated, backed by `config/validation.yaml`.
  - `validation-protocol.md` — overall stage-gated protocol a strategy must pass
  - `walk-forward.md` — out-of-sample walk-forward methodology
  - `monte-carlo.md` — Monte Carlo robustness/stress testing
  - Output goes to `reports/backtests/` and `reports/validations/`

**Strategy lifecycle**: strategies live in `strategies/` and move between `experimental/` → `validated/` or `rejected/` as they pass/fail the research skill's protocol. `strategies/pine/` holds Pine Script source. `strategies/registry.yaml` is the single source of truth for which stage each strategy is in — it should be updated whenever a strategy moves between folders.

`research/` is for freeform notes/analysis that doesn't fit the structured skill output. `reports/scans/`, `reports/backtests/`, and `reports/validations/` are generated output (gitignored except for `.gitkeep`) — treat their contents as reproducible artifacts, not source of truth. Note: `reports/backtests/sr-volume-zones_2026-07-20.md` currently exists as a real example (seeded from a live `data_get_strategy_results` read, referenced by `strategies/registry.yaml`) but is gitignored by the pattern above — untrack-by-default is the intended behavior, adjust `.gitignore` if you want specific reports kept under version control.

## Working in this repo

- When filling in skill docs (`scoring.md`, `risk-management.md`, `validation-protocol.md`, etc.), keep numeric thresholds in the corresponding `config/*.yaml` rather than hardcoding them in the markdown, so they stay a single source of truth.
- Any change to a strategy's validation stage should be reflected in `strategies/registry.yaml` and the strategy file's location under `strategies/` in the same change.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A quant trading lab built around two Claude Code skills: scanning TradingView markets for candidates, and researching/validating trading strategies (Pine Script) before they go live. The repo is currently scaffolded — most config and skill docs are TODO placeholders, not yet filled with real criteria/thresholds.

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

`research/` is for freeform notes/analysis that doesn't fit the structured skill output. `reports/scans/`, `reports/backtests/`, and `reports/validations/` are generated output (gitignored except for `.gitkeep`) — treat their contents as reproducible artifacts, not source of truth.

## Working in this repo

- When filling in skill docs (`scoring.md`, `risk-management.md`, `validation-protocol.md`, etc.), keep numeric thresholds in the corresponding `config/*.yaml` rather than hardcoding them in the markdown, so they stay a single source of truth.
- Any change to a strategy's validation stage should be reflected in `strategies/registry.yaml` and the strategy file's location under `strategies/` in the same change.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A quant trading lab built around two Claude Code skills: scanning TradingView markets for candidates, and researching/validating trading strategies (Pine Script) before they go live. The MCP connection and skill contracts are real and verified; the domain logic (regime classification, scoring, risk management, validation, scanner orchestration) is fully implemented in `scripts/` with a passing test suite.

**For architecture, module responsibilities, the strategy lifecycle, the research→validation→registry→scanner workflow, quantitative/scoring/risk-management/anti-hallucination rules, and coding conventions: see [STEERING.md](STEERING.md).** That file is the architectural source of truth; this file only covers how Claude Code specifically should behave in this repo.

## MCP connection

Both skills operate through the `tradingview` MCP server (`.mcp.json` → `node /home/king/dev/tradingview-mcp/src/server.js`, a separate sibling repo — a live bridge to TradingView Desktop via Chrome DevTools Protocol). Requires TradingView Desktop running locally with `--remote-debugging-port=9222` and a session restart in this repo to pick up `.mcp.json`.

`MCP_CAPABILITIES.md` is the source of truth for what's actually verified against this server — tool inventory, read-only vs. mutating vs. dangerous categorization, and known gaps (e.g. no per-bar equity curve, `data_get_ohlcv` capped at 500 bars, TradingView plan/historical-depth limits aren't exposed by any tool). Re-read it, don't assume a capability exists — the server wraps undocumented internal TradingView APIs that can change without notice, and re-verify after any `tv_update`.

**Hard constraints for both skills, and which of them are also enforced in code, are in [STEERING.md §8-9](STEERING.md#8-regole-mcp)** — not repeated here to avoid a second copy that can drift from the one in each `SKILL.md`.

## Commands

Stack is Node/TypeScript.

- `npm install` — install dependencies
- `npm run build` — compile `scripts/` and `tests/` via `tsc` (see `tsconfig.json`)
- `npm run typecheck` — `tsc --noEmit`
- `npm test` — runs the Vitest suite (`scripts/` has no live-MCP dependency — see [STEERING.md §3](STEERING.md#3-architettura-generale))

Copy `.env.example` to `.env` and fill in credentials before running any scripts that hit external data providers.

## Working in this repo

- Architecture, module boundaries, and permanent conventions live in [STEERING.md](STEERING.md) — update that file, not this one, when a structural or conventions decision changes.
- Each skill's supporting docs (`scoring.md`, `risk-management.md`, `output-template.md`, `validation-protocol.md`, `walk-forward.md`, `monte-carlo.md`) describe the real logic in `scripts/scoring/`, `scripts/risk/`, `scripts/validation/`, `scripts/regime/` and point to the relevant `scripts/` files directly — keep them in sync when that code changes, the same way you would code comments. Two config values remain genuinely unset regardless of doc/code sync: `config/validation.yaml`'s `walk_forward.*` window lengths and `monte_carlo.simulations` — both still `null`.
- A decision significant enough to constrain future work gets an ADR under `docs/decisions/` (format in that folder's `README.md`), with a one-line summary added to STEERING.md §18.

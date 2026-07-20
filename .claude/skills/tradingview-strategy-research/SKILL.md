---
name: tradingview-strategy-research
description: Use when researching, backtesting, or validating a trading strategy already present as a Pine Script on TradingView — e.g. "valida questa strategia", "fai walk-forward su X", "esegui Monte Carlo su Y" — before it's promoted from experimental to validated in strategies/registry.yaml.
---

# TradingView Strategy Research

Reads Strategy Tester output from the `tradingview` MCP server for a Pine strategy already open/compiled on the chart, and runs it through the validation stages. See [MCP_CAPABILITIES.md](../../../MCP_CAPABILITIES.md) for what's actually verified — in particular: `data_get_strategy_results` and `data_get_trades` are documented as auto-opening the Strategy Tester panel and auto-unhiding a hidden strategy, so they are not neutral reads; confirm with the user before the first call in a session touches an unfamiliar strategy.

The validation engine itself — normalization, derived metrics, Monte Carlo, walk-forward, parameter stability, cost sensitivity, long/short balance, and the final classifier — is implemented and tested in `scripts/research/` and `scripts/validation/`; none of it calls MCP tools (see [STEERING.md §3](../../../STEERING.md#3-architettura-generale)). See [validation-protocol.md](validation-protocol.md), [walk-forward.md](walk-forward.md), and [monte-carlo.md](monte-carlo.md) for what each module actually does and which numeric parameters (window lengths, simulation counts) are still unset in `config/validation.yaml`. This file defines the process contract: what the agent does live, in what order, against which MCP tools.

## Inputs

- The strategy must already be a compiled Pine script visible on the chart (this skill does not write Pine code)
- `strategies/registry.yaml` entry for the strategy, if one exists (created on first research pass otherwise) — schema in `scripts/schemas/registry.ts`
- `config/validation.yaml` for stage thresholds — pass/fail criteria are set (e.g. `minimum_out_of_sample_profit_factor: 1.20`, `minimum_total_trades: 200`); walk-forward window lengths and Monte Carlo simulation count are still `null`

## Process

1. `chart_get_state` to confirm which study/strategy is on the chart and capture original state
2. `pine_get_source` + `pine_check` for a static sanity check (no chart mutation — `pine_check` compiles via TradingView's server API, not the open editor) and `pine_analyze` for offline static analysis (array bounds, unguarded `array.first()`/`last()`, etc.) — note any repainting or look-ahead-bias finding, it forces a hard `rejected` verdict later regardless of metrics
3. Ask the user to confirm before the first `data_get_strategy_results` / `data_get_trades` call on a strategy this skill hasn't touched yet in the session (side-effect disclosure above)
4. `data_get_strategy_results` for aggregate metrics (net profit, profit factor, drawdown, Sharpe/Sortino, win rate, trade count — see MCP_CAPABILITIES.md for the exact fields returned). Normalize with `normalizeStrategyResults()` (`scripts/research/normalize-strategy-results.ts` — maps only the 7 field names actually verified) and sanity-check with `runBasicChecks()` (`scripts/research/basic-checks.ts`).
5. `data_get_trades` for the fill list if per-trade detail is needed for [walk-forward.md](walk-forward.md) or [monte-carlo.md](monte-carlo.md) analysis — note `max_trades` did not reliably cap output in testing, check actual response size
6. Run the stages in [validation-protocol.md](validation-protocol.md) — the real computation is `classifyStrategy()` (`scripts/validation/classify.ts`) plus whichever of `monte-carlo.ts`/`walk-forward.ts`/`parameter-stability.ts`/`cost-sensitivity.ts`/`long-short.ts` the stage needs — writing intermediate results to `reports/backtests/` (`scripts/research/backtest-report.ts`) and `reports/validations/` (`scripts/validation/validation-report.ts`)
7. Update `strategies/registry.yaml` (`stage`, `status`, `metrics`/`results`, `reports`) via `scripts/research/registry-io.ts` to reflect the outcome
8. Restore original chart state from step 1

## Hard constraints

Full rationale and which of these are also enforced in code: [STEERING.md §8-9](../../../STEERING.md#8-regole-mcp). Summary for this skill specifically:

- Never call `pine_set_source`, `pine_save`, `pine_new`, or `pine_open` without explicit per-call user confirmation — these overwrite the Pine editor and can destroy unsaved work
- Never call `replay_trade`, under any circumstance, automatically
- Never call anything in the "potentially dangerous" category of `MCP_CAPABILITIES.md`
- `data_get_equity` does not return a per-bar equity curve (verified limitation, not a bug to work around) — use `data_get_trades` fills to reconstruct one if a stage needs it; `getEquityCurve()` on the adapter throws for exactly this reason rather than returning a misleading result
- Any change to a strategy's `stage`/`status` in `strategies/registry.yaml` happens in the same pass as the report that justifies it — never leave the registry ahead of or behind the reports
- A strategy is only promoted to `status: validated` when `classifyStrategy()` actually returns `validated` against `config/validation.yaml` — never set by hand to force a result

## Output

- `reports/backtests/` and `reports/validations/`, format per [validation-protocol.md](validation-protocol.md)
- `strategies/registry.yaml` update, format per `scripts/schemas/registry.ts` (see [STEERING.md §6](../../../STEERING.md#6-lifecycle-delle-strategie) for the status lifecycle)

# Validation Protocol

Implemented in `scripts/validation/classify.ts` (`classifyStrategy`) and tested in `tests/classify.test.ts`. This file fixes which stages map to `strategies/registry.yaml`'s `stage` field and which MCP data backs each one — see [MCP_CAPABILITIES.md](../../../MCP_CAPABILITIES.md). Full architectural context: [STEERING.md §6-7](../../../STEERING.md#6-lifecycle-delle-strategie).

## Stages

`registry.yaml`'s `stage` enum: `idea -> backtest -> walk_forward -> monte_carlo -> paper -> live`.

- `backtest`: aggregate metrics from `data_get_strategy_results` (net profit, profit factor, drawdown, Sharpe/Sortino, win rate, trade count) — single in-sample run, whatever range is currently loaded on the chart
- `walk_forward`: see [walk-forward.md](walk-forward.md) — aggregation logic (`summarizeWalkForward`) is implemented; window methodology (lengths, rolling vs. anchored) is still not fixed in `config/validation.yaml`
- `monte_carlo`: see [monte-carlo.md](monte-carlo.md) — the resampling engine (`runTradeOrderMonteCarlo`) is implemented; simulation count is still not fixed in `config/validation.yaml`
- `paper` / `live`: outside this skill's scope — `tradingview-mcp` has no order-execution/broker tool, so these stages are tracked in the registry manually, not verified by this skill

## Classification (`classifyStrategy`)

Never fabricates a verdict on missing evidence. In order:

1. **Hard rejection first**: if code review (step 2 of SKILL.md's Process) found repainting or look-ahead bias, the verdict is `rejected` unconditionally — no metric is even evaluated. `config/validation.yaml`'s `reject_repainting`/`reject_lookahead_bias` are pinned `z.literal(true)` in the schema, so this can't be configured away.
2. **Missing required evidence → `needs_more_data`**, unconditionally, before any threshold is checked: if `config/validation.yaml` has `require_out_of_sample: true` and `results.out_of_sample` is absent from the registry entry (same for `require_walk_forward`/`require_monte_carlo`/`require_parameter_stability` against their respective fields).
3. **Threshold evaluation**, only once all required evidence is present: out-of-sample `profit_factor >= minimum_out_of_sample_profit_factor` (1.20), `total_trades >= minimum_total_trades` (200), `expectancy > 0` (if `require_positive_expectancy`), and — if `costs_included` is required by any of `include_commissions`/`include_spread`/`include_slippage` — that the corresponding flag on the registry entry is `true`. Any criterion that can't be evaluated (field missing) also forces `needs_more_data`, not a guess.
4. **Verdict**: all criteria pass → `validated`. Any criterion fails → `validation_failed`. Any criterion unresolved → `needs_more_data`.

Every criterion is returned with `{name, passed, detail}` — the full breakdown, not just the final verdict — and rendered into the validation report by `scripts/validation/validation-report.ts`.

## Pass/Fail Criteria

Live in `config/validation.yaml`, not hardcoded here:

- `minimum_out_of_sample_profit_factor`: 1.20
- `minimum_total_trades`: 200
- `require_positive_expectancy`, `include_commissions`, `include_spread`, `include_slippage`, `require_walk_forward`, `require_monte_carlo`, `require_parameter_stability`, `require_out_of_sample`: all `true`
- `reject_repainting`, `reject_lookahead_bias`: hard-pinned `true`

`walk_forward.in_sample_periods`/`out_of_sample_periods` and `monte_carlo.simulations` are still `null` — the computation exists, but nobody has fixed a specific window length or simulation count yet. Set them in `config/validation.yaml` before relying on `require_walk_forward`/`require_monte_carlo` for a real promotion decision.

## Registry Updates

On every stage transition, in the same pass as the report that justifies it (`scripts/research/registry-io.ts`):
- update `stage` and `status` to whatever `classifyStrategy()` actually returned — never hand-set to force a result
- update `metrics`/`results` with the latest normalized data
- append the new report path to `reports.backtests` or `reports.validations`
- bump `last_updated`

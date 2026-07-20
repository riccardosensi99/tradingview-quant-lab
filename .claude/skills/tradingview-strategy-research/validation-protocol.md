# Validation Protocol

TODO: define the end-to-end protocol a strategy must pass before moving from `experimental/` to `validated/`. This file fixes which stages map to `strategies/registry.yaml`'s `stage` field and which MCP data backs each one — see [MCP_CAPABILITIES.md](../../../MCP_CAPABILITIES.md).

## Stages

`registry.yaml`'s `stage` enum: `idea -> backtest -> walk_forward -> monte_carlo -> paper -> live`.

- `backtest`: aggregate metrics from `data_get_strategy_results` (net profit, profit factor, drawdown, Sharpe/Sortino, win rate, trade count) — single in-sample run, whatever range is currently loaded on the chart
- `walk_forward`: see [walk-forward.md](walk-forward.md) — TODO on window methodology
- `monte_carlo`: see [monte-carlo.md](monte-carlo.md) — TODO on simulation methodology, driven off `data_get_trades` fills (no native per-bar equity curve — see MCP_CAPABILITIES.md)
- `paper` / `live`: outside this skill's scope — `tradingview-mcp` has no order-execution/broker tool, so these stages are tracked in the registry manually, not verified by this skill

## Pass/Fail Criteria

TODO: quantitative thresholds (e.g. min Sharpe, max drawdown, min trade count) required at each stage. Keep thresholds in `config/validation.yaml`, not hardcoded here.

## Registry Updates

On every stage transition, in the same pass as the report that justifies it:
- update `stage` and `status` (`experimental` while stage < validated threshold, `validated` once all required stages pass, `rejected` on a hard fail)
- update `metrics` with the latest `data_get_strategy_results` output
- append the new report path to `reports.backtests` or `reports.validations`
- bump `last_updated`

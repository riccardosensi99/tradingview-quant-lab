# Walk-Forward Testing

Aggregation logic implemented in `scripts/validation/walk-forward.ts` (`summarizeWalkForward`) and tested in `tests/walk-forward.test.ts`. Mechanically, each window is still executed by moving the chart's visible range and re-reading Strategy Tester output — `tradingview-mcp` has no built-in walk-forward runner, so the agent gathers each window's result live; this module only aggregates windows it's given.

## Window Configuration

**Still TODO**: in-sample/out-of-sample window lengths, rolling vs. anchored — `config/validation.yaml`'s `walk_forward.in_sample_periods`/`out_of_sample_periods` are still `null`. Set real values there before relying on `require_walk_forward` for a promotion decision. Windows are set via `chart_set_visible_range` (unix timestamps) or `chart_scroll_to_date`; each window's results come from a fresh `data_get_strategy_results` call after the range changes and TradingView recomputes.

## Metrics

Each window is a `{label, period: {from, to}, metrics}` object — same `Metrics` shape as everywhere else in the registry (`scripts/schemas/registry.ts`), normalized from `data_get_strategy_results` via `normalizeStrategyResults()`. No additional data source per window.

`summarizeWalkForward(windows)` computes, over real windows only (throws on an empty list — it never estimates a window it wasn't given):
- `windows`: count
- `profitableWindows` / `profitableWindowRatio`: how many windows had positive net profit
- `profitFactorMean` / `profitFactorStdDev`: only computed from windows that actually have a `profit_factor` value; `null` if none do
- `worstWindowLabel`: the label of the lowest-profit-factor window, `null` if no window has one

## Pass Criteria

**Still TODO**: `config/validation.yaml` doesn't yet have a dedicated walk-forward pass/fail threshold (e.g. a minimum `profitableWindowRatio` or a maximum `profitFactorStdDev`) — today, `require_walk_forward: true` only requires that `walk_forward_results` be *present* on the registry entry for `classifyStrategy()` to proceed past `needs_more_data` (see [validation-protocol.md](validation-protocol.md)); it does not yet independently gate on the summary's stability. Add specific thresholds to `config/validation.yaml` and wire them into `classify.ts` before treating walk-forward stability as enforced.

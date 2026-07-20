# Monte Carlo Robustness Testing

Implemented in `scripts/validation/monte-carlo.ts` (`runTradeOrderMonteCarlo`) and tested in `tests/monte-carlo.test.ts`. `tradingview-mcp` has no simulation tool — this stage pulls the raw fill list via `data_get_trades` and resamples it outside TradingView, since there's no native per-bar equity curve to resample directly (`data_get_equity` returns no per-bar data — see [MCP_CAPABILITIES.md](../../../MCP_CAPABILITIES.md); the adapter's `getEquityCurve()` throws for exactly this reason rather than returning something misleading).

## Method

Trade-order Monte Carlo: reshuffles the real per-trade P&L sequence (Fisher-Yates, injectable RNG — `mulberry32()` is provided for deterministic tests) and recomputes cumulative equity and max drawdown for each shuffle. It resamples real trades; it never invents one. `runTradeOrderMonteCarlo([], ...)` throws rather than returning an empty/zeroed result.

Note `max_trades` did not reliably cap `data_get_trades` output in testing — verify the actual trade count returned before assuming full coverage, and before feeding it into this function.

**Still TODO**: number of simulations — `config/validation.yaml`'s `monte_carlo.simulations` is still `null`. Set a real value there before relying on `require_monte_carlo` for a promotion decision.

## Metrics

`runTradeOrderMonteCarlo(tradePnls, {simulations, ruinThreshold?, rng?})` returns:
- `maxDrawdownPercentiles` / `finalEquityPercentiles`: `{p5, p50, p95}` across all simulations
- `probabilityOfRuin`: fraction of simulations whose cumulative equity ever dropped to or below `ruinThreshold` — `null` if no threshold was given (never a fabricated 0)

## Pass Criteria

**Still TODO**: same gap as [walk-forward.md](walk-forward.md) — `require_monte_carlo: true` in `config/validation.yaml` only requires `monte_carlo_results` to be *present* on the registry entry for `classifyStrategy()` to proceed (see [validation-protocol.md](validation-protocol.md)); there is no threshold yet on, e.g., a maximum acceptable `probabilityOfRuin` or a minimum `p5` final equity. Add specific thresholds to `config/validation.yaml` and wire them into `classify.ts` before treating Monte Carlo robustness as enforced rather than merely recorded.

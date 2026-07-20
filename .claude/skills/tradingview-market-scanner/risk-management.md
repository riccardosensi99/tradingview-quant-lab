# Risk Management

Implemented in `scripts/risk/` (`position-sizing.ts`, `aggregate-risk.ts`, `correlation-filter.ts`) and tested in `tests/position-sizing.test.ts`, `tests/aggregate-risk.test.ts`, `tests/correlation-filter.test.ts`. Full architectural context: [STEERING.md §12](../../../STEERING.md#12-regole-di-risk-management). Advisory only — `tradingview-mcp` has no order-execution/account tool, so nothing here places or sizes a real/simulated position; it only shapes report output.

## Defaults (`config/risk.yaml`)

- `risk_per_trade_percent`: 0.5
- `max_total_risk_percent`: 1.5
- `minimum_risk_reward`: 1.8
- `maximum_open_setups`: 3
- `allow_martingale`, `allow_averaging_down`, `allow_recovery_sizing`: hard-pinned `false` — the Zod schema (`RiskConfigSchema`, `z.literal(false)`) rejects a config file that sets any of these `true`, so this isn't just a convention, it's unrepresentable.

Not hardcoded here or in the code — change the numbers in `config/risk.yaml`, not this file.

## Risk/Reward and Position Sizing

`computeRiskReward({entry, stop, target1, target2})` (`position-sizing.ts`) is pure geometry: `riskDistance = |entry - stop|`, `rrToT1/T2 = |target - entry| / riskDistance`. Throws if `entry === stop` (zero risk distance is undefined, not zero risk).

`computePositionSize({accountSize, riskPerTradePct, entry, stop})` returns `{size: null, monetaryRisk: null}` — not a fabricated default — whenever `accountSize` isn't provided, per "non calcolare la size reale se non specificato". When it is provided: `monetaryRisk = accountSize * riskPerTradePct / 100`, `size = monetaryRisk / riskDistance`.

Stop loss must derive from the strategy's invalidation logic, never be chosen backward from a desired monetary risk. Target must derive from structure/levels/the strategy's validated behavior, never stretched to hit a target R:R.

## Aggregate Risk

`selectWithinAggregateRisk(candidates, {maxTotalRiskPercent, maximumOpenSetups})` (`aggregate-risk.ts`) greedily fills from highest score down, excluding — with a stated reason, never by shrinking a position — whatever candidate would push total risk over `max_total_risk_percent` or the count over `maximum_open_setups`.

## Correlation Filter

`filterCorrelatedSetups(candidates)` (`correlation-filter.ts`):
- For a standard 6-letter FX ticker (e.g. `FX:EURUSD`), exposure is derived automatically: base currency gets `+1`/`-1` and quote currency the opposite sign, per direction (`parseForexExposure`). Two candidates sharing a currency with the same-sign exposure (e.g. EURUSD long and USDCHF short both carry `USD:short`) are correlated.
- For anything else (indices, commodities, crypto), exposure is **not** guessed — the caller must supply explicit `exposureTags`; without them, a non-FX symbol is only considered correlated with an exact repeat of itself.
- Within a correlated group, only the highest-scoring candidate is kept; the rest are excluded with a reason naming which candidate was kept instead.

## Portfolio-Level Limits

`max_position_size_pct`, `max_concurrent_positions`, `max_correlated_exposure_pct` in `config/risk.yaml` remain `null` (not yet used by any module) — since this skill can't see real open positions (no broker/account tool in `tradingview-mcp`), "concurrent positions" would need to be tracked manually (e.g. via `strategies/registry.yaml` `stage: live` entries) rather than read from TradingView, and that tracking isn't implemented yet.

# Risk Management

TODO: define the actual rules. This skill only reads — it never sizes or places real/simulated positions itself (no order-execution tool exists in `tradingview-mcp`; sizing here is advisory, for the report only).

## Position Sizing

TODO — advisory sizing shown in the scan report, driven by `config/risk.yaml`. Not enforced anywhere since this skill has no order-execution capability.

## Stop Loss / Invalidation

TODO — derived from the same OHLCV/study data used for scoring (see [scoring.md](scoring.md)), not from a separate data source.

## Portfolio-Level Limits

TODO: e.g. max concurrent positions, max sector/correlation exposure. See `config/risk.yaml`. Since this skill can't see real open positions (no broker/account tool in `tradingview-mcp`), "concurrent positions" must be tracked manually (e.g. via `strategies/registry.yaml` stage=live entries) rather than read from TradingView.

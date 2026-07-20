# Monte Carlo Robustness Testing

TODO: define the Monte Carlo methodology used to stress-test strategy robustness. `tradingview-mcp` has no simulation tool — this stage pulls the raw fill list via `data_get_trades` and simulates outside TradingView (in `scripts/`), since there's no native per-bar equity curve to resample directly (`data_get_equity` returns no per-bar data — see [MCP_CAPABILITIES.md](../../../MCP_CAPABILITIES.md)).

## Method

TODO: e.g. trade reshuffling, randomized entry slippage, bootstrapped equity curves reconstructed from `data_get_trades` fills. Number of simulations. Note `max_trades` did not reliably cap `data_get_trades` output in testing — verify the actual trade count returned before assuming full coverage.

## Metrics

TODO: e.g. distribution of max drawdown, probability of ruin, confidence intervals on returns.

## Pass Criteria

TODO: thresholds required to pass this stage. Keep in `config/validation.yaml`.

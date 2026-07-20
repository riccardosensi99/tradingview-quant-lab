# Walk-Forward Testing

TODO: define the walk-forward methodology used to validate strategies out-of-sample. Mechanically, each window is executed by moving the chart's visible range and re-reading Strategy Tester output — `tradingview-mcp` has no built-in walk-forward runner.

## Window Configuration

TODO: e.g. in-sample/out-of-sample window lengths, rolling vs. anchored. Windows are set via `chart_set_visible_range` (unix timestamps) or `chart_scroll_to_date`; each window's results come from a fresh `data_get_strategy_results` call after the range changes and TradingView recomputes.

## Metrics

TODO: what's measured per window and how results are aggregated. Same field set as `data_get_strategy_results` (see [MCP_CAPABILITIES.md](../../../MCP_CAPABILITIES.md)) — no additional data source per window.

## Pass Criteria

TODO: thresholds for a strategy to be considered stable across windows. Keep in `config/validation.yaml`.

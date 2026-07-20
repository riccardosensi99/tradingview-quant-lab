# Scoring

TODO: define the actual criteria and weights. This file only fixes which data sources feed the score, since those are constrained by what `data_get_ohlcv` / `data_get_study_values` actually return (see [MCP_CAPABILITIES.md](../../../MCP_CAPABILITIES.md)).

## Available inputs per candidate

- From `data_get_ohlcv --summary`: `open`, `close`, `high`, `low`, `range`, `change`, `change_pct`, `avg_volume`, last 5 bars
- From `data_get_study_values`: current numeric values of whatever indicators are visible on the chart (this skill does not add indicators — see SKILL.md constraints)
- From `quote_get`: real-time last price, if freshness matters more than the last closed bar

## Criteria

TODO: list criteria (e.g. trend, volume, volatility, momentum) and which of the fields above each one is computed from.

## Weighting

TODO: how criteria combine into a final score.

## Thresholds

TODO: minimum score / filters for a candidate to be included in output. Keep numeric thresholds in `config/scanner.yaml`, not hardcoded here.

// Renders a reports/backtests/<strategy-id>_<date>.md file in the same
// format as the existing real example
// (reports/backtests/sr-volume-zones_2026-07-20.md). Only metrics actually
// present on the input are rendered — absent fields are omitted from the
// table rather than shown as a fabricated placeholder.

import { BacktestReportFrontmatterSchema } from "../schemas/report.js";
import type { Metrics, StrategyStage } from "../schemas/registry.js";

export interface BacktestReportInput {
  strategyId: string;
  stage: StrategyStage;
  result: "pending" | "pass" | "fail";
  date: string;
  symbol: string;
  timeframe: string;
  source: string;
  context: string;
  metrics: Metrics;
  decision: string;
}

const METRIC_LABELS: Partial<Record<keyof Metrics, string>> = {
  net_profit: "Net profit",
  net_profit_pct: "Net profit %",
  gross_profit: "Gross profit",
  gross_loss: "Gross loss",
  profit_factor: "Profit factor",
  expectancy: "Expectancy",
  win_rate_pct: "Win rate",
  avg_win: "Average win",
  avg_loss: "Average loss",
  payoff_ratio: "Payoff ratio",
  max_drawdown_pct: "Max drawdown",
  recovery_factor: "Recovery factor",
  sharpe_ratio: "Sharpe ratio",
  sortino_ratio: "Sortino ratio",
  total_trades: "Total trades",
  avg_trade_duration: "Avg trade duration",
  max_consecutive_wins: "Max consecutive wins",
  max_consecutive_losses: "Max consecutive losses",
};

// Fixed rendering order so reports are diff-stable across runs.
const METRIC_ORDER: (keyof Metrics)[] = [
  "net_profit",
  "net_profit_pct",
  "gross_profit",
  "gross_loss",
  "profit_factor",
  "expectancy",
  "win_rate_pct",
  "avg_win",
  "avg_loss",
  "payoff_ratio",
  "max_drawdown_pct",
  "recovery_factor",
  "sharpe_ratio",
  "sortino_ratio",
  "total_trades",
  "avg_trade_duration",
  "max_consecutive_wins",
  "max_consecutive_losses",
];

function renderMetricsTable(metrics: Metrics): string {
  const rows = METRIC_ORDER.filter((key) => metrics[key] !== undefined).map(
    (key) => `| ${METRIC_LABELS[key] ?? key} | ${metrics[key]} |`,
  );
  if (rows.length === 0) {
    return "| Metric | Value |\n|---|---|\n| _(no metrics available)_ | |";
  }
  return `| Metric | Value |\n|---|---|\n${rows.join("\n")}`;
}

export function renderBacktestReport(input: BacktestReportInput): string {
  const frontmatter = BacktestReportFrontmatterSchema.parse({
    strategy_id: input.strategyId,
    stage: input.stage,
    result: input.result,
    date: input.date,
    symbol: input.symbol,
    timeframe: input.timeframe,
    source: input.source,
  });

  return `---
strategy_id: ${frontmatter.strategy_id}
stage: ${frontmatter.stage}
result: ${frontmatter.result}
date: ${frontmatter.date}
symbol: ${frontmatter.symbol}
timeframe: "${frontmatter.timeframe}"
source: ${frontmatter.source}
---

## Context

${input.context}

## Results

${renderMetricsTable(input.metrics)}

## Decisione e prossimo stage

${input.decision}
`;
}

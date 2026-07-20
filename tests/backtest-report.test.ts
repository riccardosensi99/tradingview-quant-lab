import { describe, expect, it } from "vitest";
import { renderBacktestReport } from "../scripts/research/backtest-report.js";
import { readFrontmatter } from "../scripts/lib/frontmatter.js";
import { BacktestReportFrontmatterSchema } from "../scripts/schemas/report.js";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("renderBacktestReport", () => {
  it("renders a report whose frontmatter round-trips through the real schema", () => {
    const markdown = renderBacktestReport({
      strategyId: "sr-volume-zones",
      stage: "backtest",
      result: "pending",
      date: "2026-07-20",
      symbol: "FX:USDJPY",
      timeframe: "60",
      source: "data_get_strategy_results (tradingview MCP, live read)",
      context: "Test context.",
      metrics: { profit_factor: 0.969, total_trades: 135 },
      decision: "Test decision.",
    });

    const dir = mkdtempSync(join(tmpdir(), "backtest-report-test-"));
    try {
      const file = join(dir, "report.md");
      writeFileSync(file, markdown, "utf8");
      const frontmatter = readFrontmatter(file, BacktestReportFrontmatterSchema);
      expect(frontmatter.strategy_id).toBe("sr-volume-zones");
      expect(frontmatter.result).toBe("pending");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("only renders metrics that are actually present", () => {
    const markdown = renderBacktestReport({
      strategyId: "x",
      stage: "idea",
      result: "pending",
      date: "2026-01-01",
      symbol: "FX:EURUSD",
      timeframe: "60",
      source: "test",
      context: "c",
      metrics: { profit_factor: 1.5 },
      decision: "d",
    });
    expect(markdown).toContain("Profit factor | 1.5");
    expect(markdown).not.toContain("Sharpe ratio");
    expect(markdown).not.toContain("Net profit |");
  });

  it("throws if the frontmatter fields don't validate (e.g. unknown stage)", () => {
    expect(() =>
      renderBacktestReport({
        strategyId: "x",
        // @ts-expect-error intentionally invalid for the test
        stage: "not_a_stage",
        result: "pending",
        date: "2026-01-01",
        symbol: "FX:EURUSD",
        timeframe: "60",
        source: "test",
        context: "c",
        metrics: {},
        decision: "d",
      }),
    ).toThrow();
  });
});

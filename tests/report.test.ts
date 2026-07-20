import { describe, expect, it } from "vitest";
import { readFrontmatter } from "../scripts/lib/frontmatter.js";
import {
  BacktestReportFrontmatterSchema,
  ScanReportFrontmatterSchema,
} from "../scripts/schemas/report.js";
import { repoPath } from "./test-paths.js";

describe("backtest report frontmatter", () => {
  it("parses and validates the real sr-volume-zones report", () => {
    const frontmatter = readFrontmatter(
      repoPath("reports/backtests/sr-volume-zones_2026-07-20.md"),
      BacktestReportFrontmatterSchema,
    );
    expect(frontmatter.strategy_id).toBe("sr-volume-zones");
    expect(frontmatter.stage).toBe("backtest");
    expect(frontmatter.result).toBe("pending");
    expect(frontmatter.symbol).toBe("FX:USDJPY");
  });

  it("rejects an unknown stage value", () => {
    const result = BacktestReportFrontmatterSchema.safeParse({
      strategy_id: "x",
      stage: "not_a_real_stage",
      result: "pending",
      date: "2026-01-01",
      symbol: "FX:EURUSD",
      timeframe: "60",
      source: "test",
    });
    expect(result.success).toBe(false);
  });
});

describe("scan report frontmatter", () => {
  // No real scan report exists yet (scanner isn't built until Milestone 7) —
  // this is a schema-only test against the shape fixed by output-template.md.
  it("accepts the shape documented in output-template.md", () => {
    const result = ScanReportFrontmatterSchema.safeParse({
      date: "2026-07-20T18:30:00",
      universe_source: "watchlist:ric",
      symbols_scanned: 9,
      candidates_found: 2,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a negative symbols_scanned count", () => {
    const result = ScanReportFrontmatterSchema.safeParse({
      date: "2026-07-20T18:30:00",
      universe_source: "watchlist:ric",
      symbols_scanned: -1,
      candidates_found: 0,
    });
    expect(result.success).toBe(false);
  });
});

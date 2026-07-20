import { describe, expect, it } from "vitest";
import { readFrontmatter } from "../scripts/lib/frontmatter.js";
import {
  BacktestReportFrontmatterSchema,
  GenerationReportFrontmatterSchema,
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

describe("generation report frontmatter", () => {
  // No real generation report exists yet — schema-only test against the
  // shape fixed by tradingview-strategy-generator/output-template.md.
  it("accepts the shape documented in output-template.md", () => {
    const result = GenerationReportFrontmatterSchema.safeParse({
      date: "2026-07-20T18:30:00",
      registry_strategies_count: 1,
      ideas_proposed: 2,
      ideas_discarded: 1,
      constraints_received: "--count 3 --market forex",
    });
    expect(result.success).toBe(true);
  });

  it("defaults constraints_received to an empty string when omitted", () => {
    const result = GenerationReportFrontmatterSchema.safeParse({
      date: "2026-07-20T18:30:00",
      registry_strategies_count: 1,
      ideas_proposed: 0,
      ideas_discarded: 0,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.constraints_received).toBe("");
    }
  });

  it("rejects a negative ideas_proposed count", () => {
    const result = GenerationReportFrontmatterSchema.safeParse({
      date: "2026-07-20T18:30:00",
      registry_strategies_count: 1,
      ideas_proposed: -1,
      ideas_discarded: 0,
    });
    expect(result.success).toBe(false);
  });
});

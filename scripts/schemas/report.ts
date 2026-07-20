// Zod schemas for report frontmatter.
//
// Scoped to what's already concretely specified today: the scan report
// frontmatter fixed by output-template.md, and the backtest report
// frontmatter shape already used by the one real report in the repo
// (reports/backtests/sr-volume-zones_2026-07-20.md). The validation report
// format is not schematized yet — validation-protocol.md is still TODO on
// its output shape, so inventing a schema for it now would be guessing at a
// format nobody has approved. That lands in Milestone 3 alongside the
// validation engine.

import { z } from "zod";
import { StrategyStageSchema } from "./registry.js";

/** Frontmatter for reports/scans/<YYYY-MM-DD>_<HHmm>_scan.md, per
 * .claude/skills/tradingview-market-scanner/output-template.md. */
export const ScanReportFrontmatterSchema = z.object({
  date: z.string(),
  universe_source: z.string(),
  symbols_scanned: z.number().int().nonnegative(),
  candidates_found: z.number().int().nonnegative(),
});
export type ScanReportFrontmatter = z.infer<typeof ScanReportFrontmatterSchema>;

/** Frontmatter for reports/backtests/<strategy-id>_<date>.md. `result` is
 * "pending" until config/validation.yaml's thresholds are defined and a
 * research pass evaluates the run against them. */
export const BacktestReportFrontmatterSchema = z.object({
  strategy_id: z.string(),
  stage: StrategyStageSchema,
  result: z.enum(["pending", "pass", "fail"]),
  date: z.string(),
  symbol: z.string(),
  timeframe: z.string(),
  source: z.string(),
});
export type BacktestReportFrontmatter = z.infer<typeof BacktestReportFrontmatterSchema>;

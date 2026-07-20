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

/** Frontmatter for reports/ideas/<YYYY-MM-DD>_<HHmm>_generation.md, per
 * .claude/skills/tradingview-strategy-generator/output-template.md.
 * `constraints_received` is the free-text CLI-style flags the skill was
 * invoked with (e.g. "--count 3 --market forex"), or "" if invoked bare. */
export const GenerationReportFrontmatterSchema = z.object({
  date: z.string(),
  registry_strategies_count: z.number().int().nonnegative(),
  ideas_proposed: z.number().int().nonnegative(),
  ideas_discarded: z.number().int().nonnegative(),
  constraints_received: z.string().default(""),
});
export type GenerationReportFrontmatter = z.infer<typeof GenerationReportFrontmatterSchema>;

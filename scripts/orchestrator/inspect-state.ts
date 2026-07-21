// Pure state-inspection functions over an already-loaded StrategyRegistry
// (scripts/research/registry-io.ts) and ValidationConfig
// (scripts/schemas/config.ts) — no MCP calls, no disk access. Reused by
// scripts/orchestrator/choose-workflow.ts and the status output
// (.claude/skills/tradingview-lab/output-template.md).

import type { StrategyRegistry, StrategyRegistryEntry } from "../schemas/registry.js";
import type { ValidationConfig } from "../schemas/config.js";

export interface StrategyCounts {
  experimental: number;
  validation_pending: number;
  needs_more_data: number;
  validation_failed: number;
  rejected: number;
  validated: number;
  disabled: number;
}

const EMPTY_COUNTS: StrategyCounts = {
  experimental: 0,
  validation_pending: 0,
  needs_more_data: 0,
  validation_failed: 0,
  rejected: 0,
  validated: 0,
  disabled: 0,
};

export interface RegistryStateSummary {
  counts: StrategyCounts;
  totalStrategies: number;
  withoutPine: string[];
  withPineNoBacktest: string[];
  withBacktestNoOutOfSample: string[];
  validatedPotentiallyStale: string[];
  needsMoreDataIds: string[];
  validationPendingIds: string[];
  experimentalApprovedNotBacktested: string[];
}

export const EMPTY_REGISTRY_STATE: RegistryStateSummary = {
  counts: { ...EMPTY_COUNTS },
  totalStrategies: 0,
  withoutPine: [],
  withPineNoBacktest: [],
  withBacktestNoOutOfSample: [],
  validatedPotentiallyStale: [],
  needsMoreDataIds: [],
  validationPendingIds: [],
  experimentalApprovedNotBacktested: [],
};

/** A `validated` entry is flagged as potentially stale once its last
 * validation date is at least this many days before the inspection date — a
 * starting threshold (not tuned on real data yet, same caveat as
 * config/scanner.yaml's regime thresholds). */
export const STALE_VALIDATION_DAYS = 90;

function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  return (to - from) / (1000 * 60 * 60 * 24);
}

function hasOutOfSample(entry: StrategyRegistryEntry): boolean {
  return Boolean(entry.results?.out_of_sample || entry.periods?.out_of_sample);
}

export function inspectRegistryState(registry: StrategyRegistry, asOfIso: string): RegistryStateSummary {
  const counts: StrategyCounts = { ...EMPTY_COUNTS };
  const withoutPine: string[] = [];
  const withPineNoBacktest: string[] = [];
  const withBacktestNoOutOfSample: string[] = [];
  const validatedPotentiallyStale: string[] = [];
  const needsMoreDataIds: string[] = [];
  const validationPendingIds: string[] = [];
  const experimentalApprovedNotBacktested: string[] = [];

  for (const entry of registry.strategies) {
    counts[entry.status] += 1;

    if (!entry.pine_script_id) {
      withoutPine.push(entry.id);
    } else if (entry.reports.backtests.length === 0) {
      withPineNoBacktest.push(entry.id);
    } else if (!hasOutOfSample(entry)) {
      withBacktestNoOutOfSample.push(entry.id);
    }

    if (entry.status === "needs_more_data") needsMoreDataIds.push(entry.id);
    if (entry.status === "validation_pending") validationPendingIds.push(entry.id);
    if (
      entry.status === "experimental" &&
      entry.stage !== "idea" &&
      entry.pine_script_id &&
      entry.reports.backtests.length === 0
    ) {
      experimentalApprovedNotBacktested.push(entry.id);
    }

    if (entry.status === "validated") {
      const referenceIso = entry.last_validated ?? entry.last_updated;
      if (daysBetween(referenceIso, asOfIso) >= STALE_VALIDATION_DAYS) {
        validatedPotentiallyStale.push(entry.id);
      }
    }
  }

  return {
    counts,
    totalStrategies: registry.strategies.length,
    withoutPine,
    withPineNoBacktest,
    withBacktestNoOutOfSample,
    validatedPotentiallyStale,
    needsMoreDataIds,
    validationPendingIds,
    experimentalApprovedNotBacktested,
  };
}

export interface NeedsMoreDataAssessment {
  id: string;
  /** True only when every currently-missing required criterion is blocked
   * solely by data collection that a research pass can actually perform
   * right now — never true while a required config window/simulation count
   * is still null, and never true when the blocker is "needs more live
   * trades" (that's not something a research pass resolves by re-running). */
  resumable: boolean;
  hardBlocks: string[];
  resumableGaps: string[];
}

/** Deterministically explains whether a needs_more_data strategy can be
 * usefully re-researched right now, cross-referencing the registry entry's
 * existing evidence against config/validation.yaml's require_* and
 * threshold fields — never guesses, always shows which specific criterion is missing
 * or still blocked (STEERING §2/§13). */
export function assessNeedsMoreData(
  entry: StrategyRegistryEntry,
  validationConfig: ValidationConfig,
): NeedsMoreDataAssessment {
  const hardBlocks: string[] = [];
  const resumableGaps: string[] = [];

  const hasOOS = Boolean(entry.results?.out_of_sample || entry.periods?.out_of_sample);
  if (validationConfig.require_out_of_sample && !hasOOS) {
    resumableGaps.push("out-of-sample split not yet run");
  }

  const hasWalkForward = Boolean(entry.walk_forward_results);
  if (validationConfig.require_walk_forward && !hasWalkForward) {
    if (validationConfig.walk_forward.in_sample_periods === null || validationConfig.walk_forward.out_of_sample_periods === null) {
      hardBlocks.push("config/validation.yaml walk_forward window lengths are still null");
    } else {
      resumableGaps.push("walk-forward not yet run (config windows are now set)");
    }
  }

  const hasMonteCarlo = Boolean(entry.monte_carlo_results);
  if (validationConfig.require_monte_carlo && !hasMonteCarlo) {
    if (validationConfig.monte_carlo.simulations === null) {
      hardBlocks.push("config/validation.yaml monte_carlo.simulations is still null");
    } else {
      resumableGaps.push("Monte Carlo not yet run (simulations count is now set)");
    }
  }

  const hasParamStability = Boolean(entry.parameter_stability);
  if (validationConfig.require_parameter_stability && !hasParamStability) {
    resumableGaps.push("parameter-stability not yet run");
  }

  if (entry.metrics && entry.metrics.total_trades < validationConfig.minimum_total_trades) {
    hardBlocks.push(
      `total_trades (${entry.metrics.total_trades}) is below minimum_total_trades (${validationConfig.minimum_total_trades}) — needs more live trade data, not a config change`,
    );
  }

  return {
    id: entry.id,
    resumable: hardBlocks.length === 0 && resumableGaps.length > 0,
    hardBlocks,
    resumableGaps,
  };
}

export interface DatedReport {
  date: string;
  fileName: string;
}

// Two real, different filename conventions exist across reports/:
// scans lead with the date (`<YYYY-MM-DD>_<HHmm>_scan.md`, output-template.md
// in tradingview-market-scanner), backtests/validations trail it
// (`<strategy-id>_<YYYY-MM-DD>.md`, registry-io.ts's report path convention —
// see reports/backtests/sr-volume-zones_2026-07-20.md). Search anywhere in
// the filename rather than anchoring to the start so both conventions match.
const DATED_FILENAME = /(\d{4}-\d{2}-\d{2})/;

/** Parses the `YYYY-MM-DD` date embedded in a report filename — anywhere in
 * the name, see the two real conventions above — and returns the most
 * recent one. Pure over an already-listed directory (the caller does the
 * fs.readdirSync) so it stays testable without I/O, per STEERING §14. */
export function findLatestReport(fileNames: string[]): DatedReport | null {
  let latest: DatedReport | null = null;
  for (const fileName of fileNames) {
    const match = DATED_FILENAME.exec(fileName);
    if (!match) continue;
    const date = match[1];
    if (!latest || date > latest.date) {
      latest = { date, fileName };
    }
  }
  return latest;
}

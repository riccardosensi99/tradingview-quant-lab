// Automatic classification of a strategy's status, per validation-protocol.md
// and config/validation.yaml. Never fabricates a missing input: any
// required-but-absent piece of evidence produces `needs_more_data` rather
// than a guessed pass/fail. Repainting or look-ahead bias detected during
// code review is a hard, unconditional rejection — reject_repainting and
// reject_lookahead_bias in config/validation.yaml are pinned to `true` and
// cannot be traded off against good metrics.

import type { ValidationConfig } from "../schemas/config.js";
import type { StrategyRegistryEntry, StrategyStatus } from "../schemas/registry.js";

export interface CodeReviewFindings {
  repaintingDetected?: boolean;
  lookaheadBiasDetected?: boolean;
}

export interface ClassificationCriterion {
  name: string;
  /** null means the criterion could not be evaluated — required data is missing. */
  passed: boolean | null;
  detail: string;
}

export interface ClassificationResult {
  status: StrategyStatus;
  rationale: string;
  criteria: ClassificationCriterion[];
}

function needsMoreData(name: string, detail: string): ClassificationResult {
  return {
    status: "needs_more_data",
    rationale: `Required data is missing: ${detail}`,
    criteria: [{ name, passed: false, detail }],
  };
}

export function classifyStrategy(
  entry: StrategyRegistryEntry,
  config: ValidationConfig,
  codeReview: CodeReviewFindings = {},
): ClassificationResult {
  if (codeReview.repaintingDetected) {
    return {
      status: "rejected",
      rationale: "Repainting detected during code review — reject_repainting is a hard rule and cannot be overridden by favorable metrics.",
      criteria: [{ name: "no_repainting", passed: false, detail: "repainting detected" }],
    };
  }
  if (codeReview.lookaheadBiasDetected) {
    return {
      status: "rejected",
      rationale: "Look-ahead bias detected during code review — reject_lookahead_bias is a hard rule and cannot be overridden by favorable metrics.",
      criteria: [{ name: "no_lookahead_bias", passed: false, detail: "look-ahead bias detected" }],
    };
  }

  const oos = entry.results?.out_of_sample;
  if (config.require_out_of_sample && !oos) {
    return needsMoreData("out_of_sample_present", "results.out_of_sample missing from the registry entry");
  }
  if (config.require_walk_forward && !entry.walk_forward_results) {
    return needsMoreData("walk_forward_present", "walk_forward_results missing from the registry entry");
  }
  if (config.require_monte_carlo && !entry.monte_carlo_results) {
    return needsMoreData("monte_carlo_present", "monte_carlo_results missing from the registry entry");
  }
  if (config.require_parameter_stability && !entry.parameter_stability) {
    return needsMoreData("parameter_stability_present", "parameter_stability missing from the registry entry");
  }

  const criteria: ClassificationCriterion[] = [];

  if (oos) {
    criteria.push(
      oos.profit_factor !== undefined
        ? {
            name: "out_of_sample_profit_factor",
            passed: oos.profit_factor >= config.minimum_out_of_sample_profit_factor,
            detail: `${oos.profit_factor} vs minimum ${config.minimum_out_of_sample_profit_factor}`,
          }
        : {
            name: "out_of_sample_profit_factor",
            passed: null,
            detail: "profit_factor not present in results.out_of_sample",
          },
    );

    criteria.push(
      oos.total_trades !== undefined
        ? {
            name: "minimum_total_trades",
            passed: oos.total_trades >= config.minimum_total_trades,
            detail: `${oos.total_trades} vs minimum ${config.minimum_total_trades}`,
          }
        : { name: "minimum_total_trades", passed: null, detail: "total_trades not present in results.out_of_sample" },
    );

    if (config.require_positive_expectancy) {
      criteria.push(
        oos.expectancy !== undefined
          ? { name: "positive_expectancy", passed: oos.expectancy > 0, detail: `expectancy=${oos.expectancy}` }
          : { name: "positive_expectancy", passed: null, detail: "expectancy not present in results.out_of_sample" },
      );
    }
  }

  const costFlags: [boolean, "commissions" | "spread" | "slippage"][] = [
    [config.include_commissions, "commissions"],
    [config.include_spread, "spread"],
    [config.include_slippage, "slippage"],
  ];
  for (const [required, key] of costFlags) {
    if (!required) continue;
    if (!entry.costs_included) {
      criteria.push({
        name: `${key}_included`,
        passed: null,
        detail: "costs_included block missing from the registry entry",
      });
    } else {
      criteria.push({
        name: `${key}_included`,
        passed: entry.costs_included[key],
        detail: `${key}=${entry.costs_included[key]}`,
      });
    }
  }

  const unresolved = criteria.filter((c) => c.passed === null);
  const failed = criteria.filter((c) => c.passed === false);

  if (unresolved.length > 0) {
    return {
      status: "needs_more_data",
      rationale: `${unresolved.length} criteria could not be evaluated due to missing data: ${unresolved.map((c) => c.name).join(", ")}.`,
      criteria,
    };
  }
  if (failed.length > 0) {
    return {
      status: "validation_failed",
      rationale: `Failed ${failed.length} of ${criteria.length} criteria: ${failed.map((c) => c.name).join(", ")}.`,
      criteria,
    };
  }
  return {
    status: "validated",
    rationale: "All configured validation criteria passed against the recorded out-of-sample and robustness results.",
    criteria,
  };
}

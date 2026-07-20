// Zod schema for a generated strategy hypothesis — the internal shape
// `tradingview-strategy-generator` builds and validates BEFORE anything is
// rendered into a report or (on approval) mapped down into a
// StrategyRegistryEntry (see scripts/generation/registry-entry-from-idea.ts).
//
// This is deliberately NOT part of scripts/schemas/registry.ts: the registry
// entry is a structured summary, this is the full research-grade hypothesis
// (economic rationale, deterministic rules, falsifiability conditions,
// initial research parameters) that only ever lives in a
// reports/ideas/*.md report plus the generator's own working state. Every
// field here is required rather than optional-with-omission, because an
// idea that can't state its own market behavior, rationale, deterministic
// rules, or falsification conditions has failed the quality gates in
// scripts/generation/quality-gates.ts before it ever reaches this schema's
// callers — see .claude/skills/tradingview-strategy-generator/hypothesis-template.md.

import { z } from "zod";
import { TradeDirectionSchema } from "./registry.js";

export const IdeaComplexitySchema = z.enum(["low", "medium", "high"]);
export type IdeaComplexity = z.infer<typeof IdeaComplexitySchema>;

export const CostSensitivitySchema = z.enum(["low", "medium", "high"]);
export type CostSensitivity = z.infer<typeof CostSensitivitySchema>;

export const OverfittingRiskSchema = z.enum(["low", "medium", "high"]);
export type OverfittingRisk = z.infer<typeof OverfittingRiskSchema>;

/** Every rule must be a measurable/deterministic statement, not a vague
 * concept — e.g. "ADX(14) > 25 on the setup timeframe at the close of the
 * trigger bar", not "strong trend". `direction_long`/`direction_short` are
 * optional since only the applicable one(s) need content, per `directions`. */
export const DeterministicRulesSchema = z.object({
  regime_filter: z.string(),
  htf_filter: z.string(),
  setup: z.string(),
  trigger: z.string(),
  entry: z.string(),
  stop_loss: z.string(),
  invalidation: z.string(),
  target: z.string(),
  early_exit: z.string(),
  time_stop: z.string(),
  unclosed_bar_handling: z.string(),
  cooldown: z.string(),
  pyramiding: z.string(),
  direction_long: z.string().optional(),
  direction_short: z.string().optional(),
  session_rules: z.string(),
  exclusions: z.string(),
  gap_handling: z.string(),
  exceptional_volatility_handling: z.string(),
});
export type DeterministicRules = z.infer<typeof DeterministicRulesSchema>;

/** A starting point for research, never a claimed-optimal value — see
 * registry-integration.md's "initial research parameters, not tuned
 * parameters" rule. `search_range` and `overfitting_risk` are required so a
 * parameter is never proposed without an explicit boundary and an honest
 * assessment of how easily it could be overfit. */
export const InitialResearchParameterSchema = z.object({
  name: z.string(),
  initial_value: z.union([z.number(), z.string(), z.boolean()]),
  search_range: z.string(),
  rationale: z.string(),
  overfitting_risk: OverfittingRiskSchema,
});
export type InitialResearchParameter = z.infer<typeof InitialResearchParameterSchema>;

/** What would make this idea false, unpromising, or simply unresolved yet —
 * required before an idea can pass the `falsifiable` quality gate. */
export const FalsifiabilitySchema = z.object({
  rejection_conditions: z.array(z.string()).min(1),
  needs_more_data_conditions: z.array(z.string()),
  key_assumptions: z.array(z.string()).min(1),
  possible_biases: z.array(z.string()),
  cost_sensitivity_risks: z.array(z.string()),
  excluded_markets: z.array(z.string()),
  benchmark: z.string(),
  contrary_signals: z.array(z.string()),
});
export type Falsifiability = z.infer<typeof FalsifiabilitySchema>;

export const HypothesisIdeaSchema = z.object({
  id: z.string(),
  name: z.string(),
  family: z.string(),
  version: z.string(),
  synthesis: z.string(),
  market_behavior_exploited: z.string(),
  economic_or_behavioral_rationale: z.string(),
  target_markets: z.array(z.string()),
  initial_symbols: z.array(z.string()).min(1),
  compatible_providers: z.array(z.string()),
  timeframe_context: z.string(),
  timeframe_setup: z.string(),
  timeframe_trigger: z.string(),
  target_regimes: z.array(z.string()),
  excluded_regimes: z.array(z.string()),
  sessions: z.array(z.string()),
  directions: z.array(TradeDirectionSchema).min(1),
  expected_frequency: z.string(),
  complexity: IdeaComplexitySchema,
  data_requirements: z.array(z.string()),
  volume_dependency: z.boolean(),
  multi_symbol_dependency: z.boolean(),
  expected_cost_sensitivity: CostSensitivitySchema,
  deterministic_rules: DeterministicRulesSchema,
  initial_research_parameters: z.array(InitialResearchParameterSchema).min(1),
  falsifiability: FalsifiabilitySchema,
  differentiation_notes: z.string(),
});
export type HypothesisIdea = z.infer<typeof HypothesisIdeaSchema>;

// Quality gates a generated hypothesis must clear before it's included in
// the "Idee proposte" section of a generation report — see
// .claude/skills/tradingview-strategy-generator/quality-gates.md. Mirrors
// scripts/validation/classify.ts's pattern: every gate reports its own
// {name, passed, detail}, `passed: null` means "could not be evaluated
// because required information is missing" and is NEVER treated as passing
// — an idea is only `accepted` when every gate is explicitly `true`.
//
// Several gates (no_lookahead, no_repainting_required) are necessarily a
// coarse textual pre-screen: there is no Pine code yet to run pine_analyze
// against (that happens later, once tradingview-strategy-research picks up
// an approved idea) — these gates only catch an idea whose own rule text
// already names a look-ahead/repainting pattern.

import type { HypothesisIdea } from "../schemas/hypothesis.js";
import type { OriginalityVerdict } from "./originality-check.js";

export type QualityGateName =
  | "falsifiable"
  | "codifiable"
  | "data_available"
  | "no_lookahead"
  | "no_repainting_required"
  | "costs_simulable"
  | "stop_definable"
  | "sufficiently_original"
  | "complexity_acceptable"
  | "parameter_count_acceptable";

export interface QualityGateCheck {
  name: QualityGateName;
  passed: boolean | null;
  detail: string;
}

export interface QualityGateResult {
  accepted: boolean;
  checks: QualityGateCheck[];
}

/** Risk-management thresholds are global (config/risk.yaml), so they're
 * excluded from this count — only per-strategy optimizable parameters
 * count, per hypothesis-template.md. */
export const MIN_OPTIMIZABLE_PARAMETERS = 3;
export const MAX_OPTIMIZABLE_PARAMETERS = 6;

/** Self-declared complexity must be consistent with actual parameter count —
 * this gate isn't a novelty/difficulty judgment, only an honesty check on
 * the label. "high" is capped at the same repo-wide MAX as "medium": no
 * complexity tier is allowed to exceed the hard ceiling. */
export const COMPLEXITY_PARAMETER_CAPS: Record<HypothesisIdea["complexity"], number> = {
  low: 4,
  medium: MAX_OPTIMIZABLE_PARAMETERS,
  high: MAX_OPTIMIZABLE_PARAMETERS,
};

/** Data requirements known NOT to be available through the tradingview MCP
 * server, per MCP_CAPABILITIES.md's documented gaps (per-bar equity curve,
 * Depth of Market, no broker/order-execution tool, plan tier/rate limits
 * unexposed). Case-insensitive substring match against each requirement. */
export const KNOWN_UNAVAILABLE_DATA_KEYWORDS = [
  "per-bar equity curve",
  "per bar equity curve",
  "depth of market",
  "dom panel",
  "order book",
  "broker execution",
  "broker order",
  "account balance",
  "position size from broker",
  "subscription tier",
  "rate limit",
];

const LOOKAHEAD_KEYWORDS = ["next bar", "future close", "barra successiva", "prossima barra", "future price"];
const REPAINTING_KEYWORDS = ["repaint", "ripittura", "lookahead_on", "recalculate on every tick", "ricalcola ad ogni tick"];

function containsKeyword(text: string, keywords: string[]): string | undefined {
  const lower = text.toLowerCase();
  return keywords.find((keyword) => lower.includes(keyword));
}

function hasNumericThreshold(text: string): boolean {
  return /\d/.test(text);
}

const REQUIRED_RULE_KEYS: (keyof HypothesisIdea["deterministic_rules"])[] = [
  "regime_filter",
  "htf_filter",
  "setup",
  "trigger",
  "entry",
  "stop_loss",
  "invalidation",
  "target",
  "early_exit",
  "time_stop",
  "unclosed_bar_handling",
  "cooldown",
  "pyramiding",
  "session_rules",
  "exclusions",
  "gap_handling",
  "exceptional_volatility_handling",
];

const NUMERIC_RULE_KEYS: (keyof HypothesisIdea["deterministic_rules"])[] = ["setup", "trigger", "entry", "stop_loss"];

function applicableDirectionKeys(idea: HypothesisIdea): (keyof HypothesisIdea["deterministic_rules"])[] {
  const keys: (keyof HypothesisIdea["deterministic_rules"])[] = [];
  if (idea.directions.includes("long")) keys.push("direction_long");
  if (idea.directions.includes("short")) keys.push("direction_short");
  return keys;
}

function checkFalsifiable(idea: HypothesisIdea): QualityGateCheck {
  const { rejection_conditions, key_assumptions, benchmark } = idea.falsifiability;
  if (rejection_conditions.length === 0 || key_assumptions.length === 0) {
    return { name: "falsifiable", passed: false, detail: "rejection_conditions and key_assumptions must both be non-empty" };
  }
  if (benchmark.trim().length === 0) {
    return { name: "falsifiable", passed: null, detail: "benchmark is empty — cannot assess what this idea would be judged against" };
  }
  return { name: "falsifiable", passed: true, detail: `${rejection_conditions.length} rejection condition(s), ${key_assumptions.length} key assumption(s), benchmark defined` };
}

function checkCodifiable(idea: HypothesisIdea): QualityGateCheck {
  const rules = idea.deterministic_rules;
  const keysToCheck = [...REQUIRED_RULE_KEYS, ...applicableDirectionKeys(idea)];
  const empty = keysToCheck.filter((key) => !rules[key] || rules[key]!.trim().length === 0);
  if (empty.length > 0) {
    return { name: "codifiable", passed: null, detail: `missing deterministic rule text for: ${empty.join(", ")}` };
  }
  const nonMeasurable = NUMERIC_RULE_KEYS.filter((key) => !hasNumericThreshold(rules[key]!));
  if (nonMeasurable.length > 0) {
    return {
      name: "codifiable",
      passed: false,
      detail: `no numeric threshold found in: ${nonMeasurable.join(", ")} — restate as a measurable rule (e.g. "ADX(14) > 25", not "strong trend")`,
    };
  }
  return { name: "codifiable", passed: true, detail: "all deterministic rule fields are present and setup/trigger/entry/stop_loss reference a numeric threshold" };
}

function checkDataAvailable(idea: HypothesisIdea): QualityGateCheck {
  if (idea.data_requirements.length === 0) {
    return { name: "data_available", passed: null, detail: "data_requirements is empty — cannot assess what data this idea needs" };
  }
  for (const requirement of idea.data_requirements) {
    const match = containsKeyword(requirement, KNOWN_UNAVAILABLE_DATA_KEYWORDS);
    if (match) {
      return { name: "data_available", passed: false, detail: `data requirement "${requirement}" depends on "${match}", which MCP_CAPABILITIES.md documents as unavailable` };
    }
  }
  return { name: "data_available", passed: true, detail: `${idea.data_requirements.length} data requirement(s), none flagged as unavailable` };
}

function checkNoLookahead(idea: HypothesisIdea): QualityGateCheck {
  const text = Object.values(idea.deterministic_rules).filter((v): v is string => typeof v === "string").join(" ");
  const match = containsKeyword(text, LOOKAHEAD_KEYWORDS);
  if (match) {
    return { name: "no_lookahead", passed: false, detail: `deterministic rules mention "${match}" — rewrite to only reference data available at the trigger bar's close` };
  }
  return { name: "no_lookahead", passed: true, detail: "no look-ahead phrasing found in deterministic rules (coarse textual pre-screen only — pine_analyze runs later, once Pine code exists)" };
}

function checkNoRepaintingRequired(idea: HypothesisIdea): QualityGateCheck {
  const text = Object.values(idea.deterministic_rules).filter((v): v is string => typeof v === "string").join(" ");
  const match = containsKeyword(text, REPAINTING_KEYWORDS);
  if (match) {
    return { name: "no_repainting_required", passed: false, detail: `deterministic rules mention "${match}" — rewrite to not depend on repainting behavior` };
  }
  return { name: "no_repainting_required", passed: true, detail: "no repainting phrasing found in deterministic rules (coarse textual pre-screen only — pine_analyze runs later)" };
}

function checkCostsSimulable(idea: HypothesisIdea): QualityGateCheck {
  if (idea.falsifiability.cost_sensitivity_risks.length === 0) {
    return { name: "costs_simulable", passed: null, detail: "falsifiability.cost_sensitivity_risks is empty — cost sensitivity hasn't been considered" };
  }
  return { name: "costs_simulable", passed: true, detail: `expected_cost_sensitivity=${idea.expected_cost_sensitivity}, ${idea.falsifiability.cost_sensitivity_risks.length} cost risk(s) named` };
}

function checkStopDefinable(idea: HypothesisIdea): QualityGateCheck {
  const { stop_loss, invalidation } = idea.deterministic_rules;
  if (!stop_loss || stop_loss.trim().length === 0 || !invalidation || invalidation.trim().length === 0) {
    return { name: "stop_definable", passed: null, detail: "stop_loss and/or invalidation rule text is missing" };
  }
  if (!hasNumericThreshold(stop_loss)) {
    return { name: "stop_definable", passed: false, detail: "stop_loss has no numeric threshold — restate as a measurable rule" };
  }
  return { name: "stop_definable", passed: true, detail: "stop_loss and invalidation are both defined and stop_loss references a numeric threshold" };
}

function checkSufficientlyOriginal(originality: OriginalityVerdict): QualityGateCheck {
  if (originality.verdict === "duplicate" || originality.verdict === "parameter_stability_candidate") {
    return { name: "sufficiently_original", passed: false, detail: originality.reason };
  }
  return { name: "sufficiently_original", passed: true, detail: originality.reason };
}

function checkComplexityAcceptable(idea: HypothesisIdea): QualityGateCheck {
  const cap = COMPLEXITY_PARAMETER_CAPS[idea.complexity];
  const count = idea.initial_research_parameters.length;
  if (count > cap) {
    return { name: "complexity_acceptable", passed: false, detail: `${count} parameters exceeds the ${cap}-parameter cap for complexity=${idea.complexity}` };
  }
  return { name: "complexity_acceptable", passed: true, detail: `${count} parameters within the ${cap}-parameter cap for complexity=${idea.complexity}` };
}

function checkParameterCountAcceptable(idea: HypothesisIdea): QualityGateCheck {
  const count = idea.initial_research_parameters.length;
  if (count < MIN_OPTIMIZABLE_PARAMETERS || count > MAX_OPTIMIZABLE_PARAMETERS) {
    return {
      name: "parameter_count_acceptable",
      passed: false,
      detail: `${count} parameters is outside the [${MIN_OPTIMIZABLE_PARAMETERS}, ${MAX_OPTIMIZABLE_PARAMETERS}] accepted range`,
    };
  }
  return { name: "parameter_count_acceptable", passed: true, detail: `${count} parameters within [${MIN_OPTIMIZABLE_PARAMETERS}, ${MAX_OPTIMIZABLE_PARAMETERS}]` };
}

export function runQualityGates(idea: HypothesisIdea, originality: OriginalityVerdict): QualityGateResult {
  const checks: QualityGateCheck[] = [
    checkFalsifiable(idea),
    checkCodifiable(idea),
    checkDataAvailable(idea),
    checkNoLookahead(idea),
    checkNoRepaintingRequired(idea),
    checkCostsSimulable(idea),
    checkStopDefinable(idea),
    checkSufficientlyOriginal(originality),
    checkComplexityAcceptable(idea),
    checkParameterCountAcceptable(idea),
  ];

  return { accepted: checks.every((c) => c.passed === true), checks };
}

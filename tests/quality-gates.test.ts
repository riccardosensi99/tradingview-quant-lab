import { describe, expect, it } from "vitest";
import {
  runQualityGates,
  MIN_OPTIMIZABLE_PARAMETERS,
  MAX_OPTIMIZABLE_PARAMETERS,
} from "../scripts/generation/quality-gates.js";
import type { OriginalityVerdict } from "../scripts/generation/originality-check.js";
import { makeHypothesisIdea } from "./hypothesis-fixtures.js";

const NEW_VERDICT: OriginalityVerdict = { verdict: "new", reason: "test fixture" };
const DUPLICATE_VERDICT: OriginalityVerdict = { verdict: "duplicate", matchedStrategyId: "existing", sharedDimensions: ["family"], reason: "test fixture" };

function checkFor(name: string, result: ReturnType<typeof runQualityGates>) {
  const found = result.checks.find((c) => c.name === name);
  if (!found) throw new Error(`gate ${name} not found`);
  return found;
}

describe("runQualityGates", () => {
  it("accepts a fully well-formed idea against a new originality verdict", () => {
    const result = runQualityGates(makeHypothesisIdea(), NEW_VERDICT);
    expect(result.accepted).toBe(true);
    expect(result.checks.every((c) => c.passed === true)).toBe(true);
  });

  it("fails falsifiable when rejection_conditions is empty", () => {
    const idea = makeHypothesisIdea();
    idea.falsifiability.rejection_conditions = [];
    const result = runQualityGates(idea, NEW_VERDICT);
    expect(checkFor("falsifiable", result).passed).toBe(false);
    expect(result.accepted).toBe(false);
  });

  it("marks falsifiable as null (not passing) when benchmark is empty", () => {
    const idea = makeHypothesisIdea();
    idea.falsifiability.benchmark = "";
    const result = runQualityGates(idea, NEW_VERDICT);
    const check = checkFor("falsifiable", result);
    expect(check.passed).toBeNull();
    expect(result.accepted).toBe(false);
  });

  it("marks codifiable as null when a required rule field is empty", () => {
    const idea = makeHypothesisIdea();
    idea.deterministic_rules.cooldown = "";
    const result = runQualityGates(idea, NEW_VERDICT);
    const check = checkFor("codifiable", result);
    expect(check.passed).toBeNull();
    expect(check.detail).toContain("cooldown");
  });

  it("fails codifiable when a core rule field has no numeric threshold", () => {
    const idea = makeHypothesisIdea();
    idea.deterministic_rules.setup = "a generally strong-looking setup";
    const result = runQualityGates(idea, NEW_VERDICT);
    const check = checkFor("codifiable", result);
    expect(check.passed).toBe(false);
    expect(check.detail).toContain("setup");
  });

  it("marks data_available as null when data_requirements is empty", () => {
    const idea = makeHypothesisIdea({ data_requirements: [] });
    const result = runQualityGates(idea, NEW_VERDICT);
    expect(checkFor("data_available", result).passed).toBeNull();
  });

  it("fails data_available when a requirement depends on a known-unavailable capability", () => {
    const idea = makeHypothesisIdea({ data_requirements: ["Depth of Market order book snapshots"] });
    const result = runQualityGates(idea, NEW_VERDICT);
    expect(checkFor("data_available", result).passed).toBe(false);
  });

  it("fails no_lookahead when a rule references future bars", () => {
    const idea = makeHypothesisIdea();
    idea.deterministic_rules.entry = "enter using the next bar's open price";
    const result = runQualityGates(idea, NEW_VERDICT);
    expect(checkFor("no_lookahead", result).passed).toBe(false);
  });

  it("fails no_repainting_required when a rule references repainting behavior", () => {
    const idea = makeHypothesisIdea();
    idea.deterministic_rules.trigger = "trigger may repaint on historical bars";
    const result = runQualityGates(idea, NEW_VERDICT);
    expect(checkFor("no_repainting_required", result).passed).toBe(false);
  });

  it("marks costs_simulable as null when cost_sensitivity_risks is empty", () => {
    const idea = makeHypothesisIdea();
    idea.falsifiability.cost_sensitivity_risks = [];
    const result = runQualityGates(idea, NEW_VERDICT);
    expect(checkFor("costs_simulable", result).passed).toBeNull();
  });

  it("marks stop_definable as null when stop_loss is empty", () => {
    const idea = makeHypothesisIdea();
    idea.deterministic_rules.stop_loss = "";
    const result = runQualityGates(idea, NEW_VERDICT);
    expect(checkFor("stop_definable", result).passed).toBeNull();
  });

  it("fails stop_definable when stop_loss has no numeric threshold", () => {
    const idea = makeHypothesisIdea();
    idea.deterministic_rules.stop_loss = "a reasonably wide stop";
    const result = runQualityGates(idea, NEW_VERDICT);
    expect(checkFor("stop_definable", result).passed).toBe(false);
  });

  it("fails sufficiently_original and forces accepted=false on a duplicate verdict", () => {
    const result = runQualityGates(makeHypothesisIdea(), DUPLICATE_VERDICT);
    expect(checkFor("sufficiently_original", result).passed).toBe(false);
    expect(result.accepted).toBe(false);
  });

  it("passes sufficiently_original on a variant_of_existing verdict", () => {
    const variant: OriginalityVerdict = { verdict: "variant_of_existing", matchedStrategyId: "x", sharedDimensions: ["family"], reason: "test" };
    const result = runQualityGates(makeHypothesisIdea(), variant);
    expect(checkFor("sufficiently_original", result).passed).toBe(true);
  });

  it("fails complexity_acceptable when parameter count exceeds the complexity's cap", () => {
    const idea = makeHypothesisIdea({ complexity: "low" });
    idea.initial_research_parameters = [
      ...idea.initial_research_parameters,
      { name: "extra_param", initial_value: 1, search_range: "0-2", rationale: "test", overfitting_risk: "high" },
    ];
    expect(idea.initial_research_parameters.length).toBe(5); // exceeds the low-complexity cap of 4
    const result = runQualityGates(idea, NEW_VERDICT);
    expect(checkFor("complexity_acceptable", result).passed).toBe(false);
  });

  it("fails parameter_count_acceptable below the minimum", () => {
    const idea = makeHypothesisIdea();
    idea.initial_research_parameters = idea.initial_research_parameters.slice(0, 1);
    expect(idea.initial_research_parameters.length).toBeLessThan(MIN_OPTIMIZABLE_PARAMETERS);
    const result = runQualityGates(idea, NEW_VERDICT);
    expect(checkFor("parameter_count_acceptable", result).passed).toBe(false);
  });

  it("fails parameter_count_acceptable above the maximum", () => {
    const idea = makeHypothesisIdea();
    const extra = Array.from({ length: 4 }, (_, i) => ({
      name: `extra_${i}`,
      initial_value: 1,
      search_range: "0-2",
      rationale: "test",
      overfitting_risk: "low" as const,
    }));
    idea.initial_research_parameters = [...idea.initial_research_parameters, ...extra];
    expect(idea.initial_research_parameters.length).toBeGreaterThan(MAX_OPTIMIZABLE_PARAMETERS);
    const result = runQualityGates(idea, NEW_VERDICT);
    expect(checkFor("parameter_count_acceptable", result).passed).toBe(false);
  });

  it("never reports accepted=true when any check is null", () => {
    const idea = makeHypothesisIdea();
    idea.falsifiability.benchmark = "";
    const result = runQualityGates(idea, NEW_VERDICT);
    expect(result.checks.some((c) => c.passed === null)).toBe(true);
    expect(result.accepted).toBe(false);
  });
});

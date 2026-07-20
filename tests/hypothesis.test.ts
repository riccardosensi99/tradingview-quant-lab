import { describe, expect, it } from "vitest";
import { HypothesisIdeaSchema } from "../scripts/schemas/hypothesis.js";
import { makeHypothesisIdea } from "./hypothesis-fixtures.js";

describe("HypothesisIdeaSchema", () => {
  it("parses a fully-specified valid idea", () => {
    const result = HypothesisIdeaSchema.safeParse(makeHypothesisIdea());
    expect(result.success).toBe(true);
  });

  it("rejects an idea missing a required deterministic_rules field", () => {
    const idea = makeHypothesisIdea();
    const { stop_loss, ...rest } = idea.deterministic_rules;
    const result = HypothesisIdeaSchema.safeParse({ ...idea, deterministic_rules: rest });
    expect(result.success).toBe(false);
  });

  it("rejects an idea with empty falsifiability.rejection_conditions", () => {
    const idea = makeHypothesisIdea();
    const result = HypothesisIdeaSchema.safeParse({
      ...idea,
      falsifiability: { ...idea.falsifiability, rejection_conditions: [] },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an idea with empty falsifiability.key_assumptions", () => {
    const idea = makeHypothesisIdea();
    const result = HypothesisIdeaSchema.safeParse({
      ...idea,
      falsifiability: { ...idea.falsifiability, key_assumptions: [] },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an idea with no initial_research_parameters", () => {
    const idea = makeHypothesisIdea();
    const result = HypothesisIdeaSchema.safeParse({ ...idea, initial_research_parameters: [] });
    expect(result.success).toBe(false);
  });

  it("rejects an idea with no initial_symbols", () => {
    const idea = makeHypothesisIdea();
    const result = HypothesisIdeaSchema.safeParse({ ...idea, initial_symbols: [] });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown direction value", () => {
    const idea = makeHypothesisIdea();
    const result = HypothesisIdeaSchema.safeParse({ ...idea, directions: ["sideways"] });
    expect(result.success).toBe(false);
  });

  it("allows direction_long/direction_short to be independently absent", () => {
    const idea = makeHypothesisIdea();
    const { direction_short, ...rulesWithoutShort } = idea.deterministic_rules;
    const result = HypothesisIdeaSchema.safeParse({ ...idea, deterministic_rules: rulesWithoutShort });
    expect(result.success).toBe(true);
  });
});

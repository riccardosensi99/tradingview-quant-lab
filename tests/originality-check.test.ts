import { describe, expect, it } from "vitest";
import { checkOriginality, DUPLICATE_TEXT_OVERLAP_TOKENS } from "../scripts/generation/originality-check.js";
import { makeStrategyEntry } from "./scanner-fixtures.js";
import { makeHypothesisIdea } from "./hypothesis-fixtures.js";
import type { StrategyRegistry } from "../scripts/schemas/registry.js";

describe("checkOriginality", () => {
  it("returns new against an empty registry", () => {
    const result = checkOriginality(makeHypothesisIdea(), { strategies: [] });
    expect(result.verdict).toBe("new");
  });

  it("returns new when no entry shares the idea's family", () => {
    const registry: StrategyRegistry = { strategies: [makeStrategyEntry({ id: "other", family: "range_mean_reversion" })] };
    const result = checkOriginality(makeHypothesisIdea({ family: "trend_pullback" }), registry);
    expect(result.verdict).toBe("new");
  });

  it("returns new when family matches but regime and direction don't overlap", () => {
    const idea = makeHypothesisIdea({ family: "trend_pullback", target_regimes: ["strong_trend"], directions: ["long"] });
    const registry: StrategyRegistry = {
      strategies: [makeStrategyEntry({ id: "other", family: "trend_pullback", regimes_supported: ["range"], directions_supported: ["short"] })],
    };
    const result = checkOriginality(idea, registry);
    expect(result.verdict).toBe("new");
  });

  it("returns variant_of_existing when family+direction overlap but descriptive text differs", () => {
    const idea = makeHypothesisIdea({ family: "trend_pullback", target_regimes: ["strong_trend"], directions: ["long"] });
    const registry: StrategyRegistry = {
      strategies: [
        makeStrategyEntry({
          id: "other",
          family: "trend_pullback",
          regimes_supported: ["strong_trend"],
          directions_supported: ["long"],
          notes: "Completely unrelated descriptive text about something else entirely, sharing no vocabulary at all.",
        }),
      ],
    };
    const result = checkOriginality(idea, registry);
    expect(result.verdict).toBe("variant_of_existing");
    if (result.verdict === "variant_of_existing") {
      expect(result.matchedStrategyId).toBe("other");
    }
  });

  it("returns duplicate when family+regime+direction overlap and descriptive text overlaps heavily", () => {
    const idea = makeHypothesisIdea({ family: "trend_pullback", target_regimes: ["strong_trend"], directions: ["long"] });
    const registry: StrategyRegistry = {
      strategies: [
        makeStrategyEntry({
          id: "near-duplicate",
          family: "trend_pullback",
          regimes_supported: ["strong_trend"],
          directions_supported: ["long"],
          notes: idea.synthesis, // guarantees >= DUPLICATE_TEXT_OVERLAP_TOKENS shared tokens
        }),
      ],
    };
    const result = checkOriginality(idea, registry);
    expect(result.verdict).toBe("duplicate");
    if (result.verdict === "duplicate") {
      expect(result.matchedStrategyId).toBe("near-duplicate");
    }
  });

  it("returns parameter_stability_candidate when parameter names overlap heavily but text does not", () => {
    const idea = makeHypothesisIdea({ family: "trend_pullback", target_regimes: ["strong_trend"], directions: ["long"] });
    const registry: StrategyRegistry = {
      strategies: [
        makeStrategyEntry({
          id: "param-twin",
          family: "trend_pullback",
          regimes_supported: ["strong_trend"],
          directions_supported: ["long"],
          notes: "Totally different descriptive prose sharing no vocabulary whatsoever with the idea under test.",
          parameters: { initial_research_parameters: idea.initial_research_parameters },
        }),
      ],
    };
    const result = checkOriginality(idea, registry);
    expect(result.verdict).toBe("parameter_stability_candidate");
    if (result.verdict === "parameter_stability_candidate") {
      expect(result.matchedStrategyId).toBe("param-twin");
    }
  });

  it("picks the strongest match across multiple entries", () => {
    const idea = makeHypothesisIdea({ family: "trend_pullback", target_regimes: ["strong_trend"], directions: ["long"] });
    const registry: StrategyRegistry = {
      strategies: [
        makeStrategyEntry({ id: "weak-match", family: "trend_pullback", regimes_supported: ["strong_trend"], directions_supported: ["long"], notes: "Unrelated text." }),
        makeStrategyEntry({ id: "strong-match", family: "trend_pullback", regimes_supported: ["strong_trend"], directions_supported: ["long"], notes: idea.synthesis }),
      ],
    };
    const result = checkOriginality(idea, registry);
    expect(result.verdict).toBe("duplicate");
    if (result.verdict === "duplicate") {
      expect(result.matchedStrategyId).toBe("strong-match");
    }
  });

  it("DUPLICATE_TEXT_OVERLAP_TOKENS is a positive threshold", () => {
    expect(DUPLICATE_TEXT_OVERLAP_TOKENS).toBeGreaterThan(0);
  });
});

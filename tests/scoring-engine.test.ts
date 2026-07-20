import { describe, expect, it } from "vitest";
import { computeScore } from "../scripts/scoring/scoring-engine.js";
import { SCORE_COMPONENT_MAX, ScoreComponent } from "../scripts/scoring/types.js";

function fullMarksComponents(): ScoreComponent[] {
  return (Object.keys(SCORE_COMPONENT_MAX) as (keyof typeof SCORE_COMPONENT_MAX)[]).map((name) => ({
    name,
    value: SCORE_COMPONENT_MAX[name],
    max: SCORE_COMPONENT_MAX[name],
    rationale: "test",
    dataUsed: {},
  }));
}

describe("SCORE_COMPONENT_MAX", () => {
  it("sums to exactly 100, per the research spec", () => {
    const total = Object.values(SCORE_COMPONENT_MAX).reduce((a, b) => a + b, 0);
    expect(total).toBe(100);
  });
});

describe("computeScore", () => {
  it("sums all-full-marks components to 100 with no penalties", () => {
    const result = computeScore({
      components: fullMarksComponents(),
      penalties: [],
      exclusionFlags: {},
      minScore: 75,
    });
    expect(result.rawTotal).toBe(100);
    expect(result.finalScore).toBe(100);
    expect(result.tier).toBe("exceptional");
    expect(result.excluded).toBe(false);
  });

  it("applies penalties and floors at 0", () => {
    const components = fullMarksComponents().map((c) => ({ ...c, value: 0 }));
    const result = computeScore({
      components,
      penalties: [{ name: "wide_spread", points: -20, rationale: "test" }],
      exclusionFlags: {},
      minScore: 75,
    });
    expect(result.finalScore).toBe(0);
  });

  it("excludes when finalScore is below min_score", () => {
    const components = fullMarksComponents().map((c) => ({ ...c, value: Math.round(c.max * 0.5) }));
    const result = computeScore({ components, penalties: [], exclusionFlags: {}, minScore: 75 });
    expect(result.excluded).toBe(true);
    expect(result.exclusionReason).toContain("below min_score");
  });

  it("excludes on a hard exclusion flag even with a perfect score", () => {
    const result = computeScore({
      components: fullMarksComponents(),
      penalties: [],
      exclusionFlags: { strategyNotValidated: true },
      minScore: 75,
    });
    expect(result.excluded).toBe(true);
    expect(result.exclusionReason).toContain("strategyNotValidated");
  });

  it("throws when a required component is missing", () => {
    const components = fullMarksComponents().filter((c) => c.name !== "session");
    expect(() => computeScore({ components, penalties: [], exclusionFlags: {}, minScore: 75 })).toThrow(
      /missing required score component "session"/,
    );
  });

  it("throws when a component's value exceeds its own max", () => {
    const components = fullMarksComponents();
    components[0] = { ...components[0], value: components[0].max + 1 };
    expect(() => computeScore({ components, penalties: [], exclusionFlags: {}, minScore: 75 })).toThrow();
  });

  it("throws when a component's declared max doesn't match the spec cap", () => {
    const components = fullMarksComponents();
    components[0] = { ...components[0], max: 999 };
    expect(() => computeScore({ components, penalties: [], exclusionFlags: {}, minScore: 75 })).toThrow();
  });

  it("assigns tier boundaries per the spec (90/80/75)", () => {
    const at = (score: number) => {
      const components = fullMarksComponents();
      const remaining = 100 - score;
      // Zero out session's 5 points progressively then leave a remainder penalty to land exactly on `score`.
      const zeroed = components.map((c) => ({ ...c, value: 0 }));
      return computeScore({
        components: zeroed,
        penalties: [{ name: "adjust", points: score, rationale: "test" }],
        exclusionFlags: {},
        minScore: 0,
      }).tier;
    };
    expect(at(90)).toBe("exceptional");
    expect(at(89)).toBe("strong");
    expect(at(80)).toBe("strong");
    expect(at(79)).toBe("valid");
    expect(at(75)).toBe("valid");
    expect(at(74)).toBe("below_75");
  });
});

import { describe, expect, it } from "vitest";
import { scoreRegimeComponent } from "../scripts/scoring/regime-component.js";
import type { RegimeClassification } from "../scripts/regime/types.js";

describe("scoreRegimeComponent", () => {
  it("scores 0 for an uncertain regime", () => {
    const classification: RegimeClassification = { regime: "uncertain", confidence: 0, metricsUsed: [], conflicts: [] };
    expect(scoreRegimeComponent(classification).value).toBe(0);
  });

  it("scores proportionally to confidence for a resolved regime", () => {
    const classification: RegimeClassification = {
      regime: "strong_trend",
      confidence: 0.8,
      metricsUsed: [],
      conflicts: [],
    };
    const component = scoreRegimeComponent(classification);
    expect(component.value).toBe(12); // round(0.8 * 15)
    expect(component.max).toBe(15);
  });

  it("scores full marks for full confidence", () => {
    const classification: RegimeClassification = { regime: "range", confidence: 1, metricsUsed: [], conflicts: [] };
    expect(scoreRegimeComponent(classification).value).toBe(15);
  });
});

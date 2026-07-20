import { describe, expect, it } from "vitest";
import { assessParameterStability, ParameterGridPoint } from "../scripts/validation/parameter-stability.js";

describe("assessParameterStability", () => {
  it("does not flag a stable plateau of similar results", () => {
    const points: ParameterGridPoint[] = [
      { params: { length: 18 }, metricValue: 1.3 },
      { params: { length: 19 }, metricValue: 1.32 },
      { params: { length: 20 }, metricValue: 1.35 },
      { params: { length: 21 }, metricValue: 1.31 },
      { params: { length: 22 }, metricValue: 1.29 },
    ];
    const result = assessParameterStability(points);
    expect(result.isolatedPeak).toBe(false);
    expect(result.best.params.length).toBe(20);
  });

  it("flags an isolated single-point peak surrounded by much worse neighbors", () => {
    const points: ParameterGridPoint[] = [
      { params: { length: 17 }, metricValue: 0.3 },
      { params: { length: 18 }, metricValue: 0.4 },
      { params: { length: 19 }, metricValue: 0.5 },
      { params: { length: 20 }, metricValue: 6.0 }, // isolated spike
      { params: { length: 21 }, metricValue: 0.6 },
      { params: { length: 22 }, metricValue: 0.7 },
      { params: { length: 23 }, metricValue: 0.45 },
    ];
    const result = assessParameterStability(points);
    expect(result.isolatedPeak).toBe(true);
    expect(result.best.params.length).toBe(20);
  });

  it("throws with fewer than 2 points", () => {
    expect(() => assessParameterStability([{ params: {}, metricValue: 1 }])).toThrow();
  });
});

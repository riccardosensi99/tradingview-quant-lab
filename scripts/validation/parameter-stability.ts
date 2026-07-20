// Parameter stability heuristic over a real parameter grid (each point
// coming from an actual re-run of the Strategy Tester with different Pine
// inputs — this module does not generate grid points, only assesses ones
// it's given). Flags a "suspect" configuration per the research spec: a
// best point that sits far outside the spread of its neighbors is a sign of
// overfitting rather than a stable edge.

export interface ParameterGridPoint {
  params: Record<string, number | string>;
  metricValue: number;
}

export interface ParameterStabilityResult {
  points: number;
  best: ParameterGridPoint;
  mean: number;
  stdDev: number;
  coefficientOfVariation: number;
  /** True when the best point is more than `isolationZScore` standard
   * deviations above the grid mean — an isolated peak. */
  isolatedPeak: boolean;
}

export interface ParameterStabilityOptions {
  /** z-score threshold above which the best point is flagged isolated. Default 2. */
  isolationZScore?: number;
}

export function assessParameterStability(
  points: ParameterGridPoint[],
  options: ParameterStabilityOptions = {},
): ParameterStabilityResult {
  if (points.length < 2) {
    throw new Error("assessParameterStability requires at least 2 real grid points to assess stability");
  }

  const values = points.map((p) => p.metricValue);
  const meanValue = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - meanValue) ** 2, 0) / values.length;
  const stdDevValue = Math.sqrt(variance);
  const coefficientOfVariation = stdDevValue / (Math.abs(meanValue) || Number.EPSILON);

  const best = points.reduce((a, b) => (b.metricValue > a.metricValue ? b : a));
  const zScore = stdDevValue === 0 ? 0 : (best.metricValue - meanValue) / stdDevValue;
  const threshold = options.isolationZScore ?? 2;

  return {
    points: points.length,
    best,
    mean: meanValue,
    stdDev: stdDevValue,
    coefficientOfVariation,
    isolatedPeak: zScore > threshold,
  };
}

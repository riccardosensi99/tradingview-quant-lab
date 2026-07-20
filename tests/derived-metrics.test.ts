import { describe, expect, it } from "vitest";
import {
  computeExpectancy,
  computePayoffRatio,
  computeRecoveryFactor,
} from "../scripts/validation/derived-metrics.js";

describe("derived-metrics", () => {
  it("computeExpectancy matches the standard formula", () => {
    // 40% win rate, avg win 100, avg loss 50 -> 0.4*100 - 0.6*50 = 40 - 30 = 10
    expect(computeExpectancy(40, 100, 50)).toBeCloseTo(10);
  });

  it("computePayoffRatio divides avg win by |avg loss|", () => {
    expect(computePayoffRatio(150, -50)).toBeCloseTo(3);
  });

  it("computePayoffRatio throws on zero avgLoss", () => {
    expect(() => computePayoffRatio(100, 0)).toThrow();
  });

  it("computeRecoveryFactor divides net profit by |max drawdown|", () => {
    expect(computeRecoveryFactor(1000, -200)).toBeCloseTo(5);
  });

  it("computeRecoveryFactor throws on zero drawdown", () => {
    expect(() => computeRecoveryFactor(1000, 0)).toThrow();
  });
});

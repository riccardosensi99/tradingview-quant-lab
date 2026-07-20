import { describe, expect, it } from "vitest";
import { mulberry32, runTradeOrderMonteCarlo } from "../scripts/validation/monte-carlo.js";

describe("runTradeOrderMonteCarlo", () => {
  const trades = [10, -5, 20, -15, 8, -3, 12, -20, 5, -2];

  it("is deterministic given a seeded rng", () => {
    const a = runTradeOrderMonteCarlo(trades, { simulations: 200, rng: mulberry32(42) });
    const b = runTradeOrderMonteCarlo(trades, { simulations: 200, rng: mulberry32(42) });
    expect(a).toEqual(b);
  });

  it("final equity percentiles all equal the sum of trades (order doesn't change the sum)", () => {
    const total = trades.reduce((a, b) => a + b, 0);
    const result = runTradeOrderMonteCarlo(trades, { simulations: 200, rng: mulberry32(7) });
    expect(result.finalEquityPercentiles.p50).toBeCloseTo(total);
  });

  it("computes a probability of ruin when a ruinThreshold is set", () => {
    const result = runTradeOrderMonteCarlo(trades, {
      simulations: 500,
      ruinThreshold: -1000, // unreachable given these trades
      rng: mulberry32(1),
    });
    expect(result.probabilityOfRuin).toBe(0);
  });

  it("leaves probabilityOfRuin null when no threshold is given", () => {
    const result = runTradeOrderMonteCarlo(trades, { simulations: 50, rng: mulberry32(1) });
    expect(result.probabilityOfRuin).toBeNull();
  });

  it("throws on an empty trade list — cannot fabricate trades", () => {
    expect(() => runTradeOrderMonteCarlo([], { simulations: 100 })).toThrow();
  });

  it("throws on a non-positive simulation count", () => {
    expect(() => runTradeOrderMonteCarlo(trades, { simulations: 0 })).toThrow();
  });
});

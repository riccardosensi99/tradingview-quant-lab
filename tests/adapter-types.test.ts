import { describe, expect, it } from "vitest";
import {
  RawStrategyResultsSchema,
  RawTradeFillSchema,
  RawTradesResponseSchema,
  UnverifiedPayloadSchema,
} from "../scripts/adapter/types.js";

describe("RawStrategyResultsSchema", () => {
  it("accepts the 7 verified fields and passes through unverified extras", () => {
    // Simulates a full ~19-field response — only 7 field names are actually
    // verified in MCP_CAPABILITIES.md, the rest are unknown-but-real extras.
    const result = RawStrategyResultsSchema.parse({
      net_profit: -0.059,
      profit_factor: 0.969,
      max_drawdown_percent: 0.478,
      total_trades: 135,
      win_rate: 29.6,
      sharpe: -2.347,
      sortino: -0.92,
      some_unverified_field: "kept as-is",
      another_one: 42,
    });
    expect(result.profit_factor).toBe(0.969);
    expect(result.some_unverified_field).toBe("kept as-is");
  });

  it("accepts a payload missing some verified fields (all optional)", () => {
    const result = RawStrategyResultsSchema.parse({ profit_factor: 1.5 });
    expect(result.profit_factor).toBe(1.5);
    expect(result.net_profit).toBeUndefined();
  });
});

describe("RawTradeFillSchema / RawTradesResponseSchema", () => {
  it("validates a list of trade fills", () => {
    const trades = RawTradesResponseSchema.parse([
      { id: 1, type: "entry", side: "long", price: 150.2, qty: 1, time_index: 100 },
      { id: 2, type: "exit", side: "long", price: 151.0, qty: 1, time_index: 110, extra_field: true },
    ]);
    expect(trades).toHaveLength(2);
    expect(trades[1].extra_field).toBe(true);
  });

  it("rejects a non-array response", () => {
    expect(() => RawTradesResponseSchema.parse({ not: "an array" })).toThrow();
  });
});

describe("UnverifiedPayloadSchema", () => {
  it("accepts plain objects and arrays without asserting field names", () => {
    expect(UnverifiedPayloadSchema.parse({ anything: "goes" })).toBeDefined();
    expect(UnverifiedPayloadSchema.parse([1, 2, 3])).toBeDefined();
  });

  it("rejects primitives", () => {
    expect(() => UnverifiedPayloadSchema.parse("just a string")).toThrow();
  });
});

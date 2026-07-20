import { describe, expect, it } from "vitest";
import {
  RawStrategyResultsSchema,
  RawTradeFillSchema,
  RawTradesResponseSchema,
  UnverifiedPayloadSchema,
} from "../scripts/adapter/types.js";

describe("RawStrategyResultsSchema", () => {
  it("accepts the 8 verified fields and passes through unverified extras", () => {
    // Simulates a full ~19-field response — only 8 field names are actually
    // verified in MCP_CAPABILITIES.md, the rest are unknown-but-real extras.
    const result = RawStrategyResultsSchema.parse({
      net_profit: -5.921068200000036,
      net_profit_percent: -0.0005921068200000036,
      profit_factor: 0.969026354992589,
      max_drawdown_percent: 0.004781769874421474,
      total_trades: 135,
      percent_profitable: 0.2962962962962963,
      sharpe_ratio: -2.352952197836081,
      sortino_ratio: -0.9203315779840591,
      some_unverified_field: "kept as-is",
      another_one: 42,
    });
    expect(result.profit_factor).toBe(0.969026354992589);
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

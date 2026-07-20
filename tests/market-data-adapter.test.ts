import { describe, expect, it, vi } from "vitest";
import { createMarketDataAdapter, RawToolCaller } from "../scripts/adapter/market-data-adapter.js";
import { McpToolError, MissingCapabilityError } from "../scripts/adapter/errors.js";
import { MAX_OHLCV_BARS_PER_CALL } from "../scripts/adapter/capabilities.js";

describe("MarketDataAdapter", () => {
  it("validates and audit-logs a successful strategy results call", async () => {
    const call: RawToolCaller = vi.fn(async () => ({
      net_profit: -0.059,
      profit_factor: 0.969,
      total_trades: 135,
    }));
    const adapter = createMarketDataAdapter(call);
    const result = await adapter.getStrategyResults({ symbol: "FX:USDJPY" });

    expect(result.profit_factor).toBe(0.969);
    expect(call).toHaveBeenCalledWith("data_get_strategy_results", { symbol: "FX:USDJPY", timeframe: undefined });
    expect(adapter.auditLog.toolsUsed()).toEqual(["data_get_strategy_results"]);
    expect(adapter.auditLog.failures()).toHaveLength(0);
  });

  it("wraps a raw call failure into McpToolError and logs it as a failure", async () => {
    const call: RawToolCaller = vi.fn(async () => {
      throw new Error("CDP connection lost");
    });
    const adapter = createMarketDataAdapter(call);

    await expect(adapter.getWatchlist()).rejects.toThrow(McpToolError);
    expect(adapter.auditLog.failures()).toHaveLength(1);
    expect(adapter.auditLog.failures()[0].error).toContain("CDP connection lost");
  });

  it("wraps a schema-invalid response into McpToolError without calling twice", async () => {
    const call: RawToolCaller = vi.fn(async () => "not an array of trades");
    const adapter = createMarketDataAdapter(call);

    await expect(adapter.getTrades()).rejects.toThrow(McpToolError);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("refuses to request more bars than the verified per-call cap, without calling the tool", async () => {
    const call: RawToolCaller = vi.fn(async () => ({}));
    const adapter = createMarketDataAdapter(call);

    await expect(
      adapter.getOhlcvSummary({ symbol: "FX:EURUSD", timeframe: "60", bars: MAX_OHLCV_BARS_PER_CALL + 1 }),
    ).rejects.toThrow(MissingCapabilityError);
    expect(call).not.toHaveBeenCalled();
  });

  it("getEquityCurve always throws MissingCapabilityError — no per-bar equity curve is exposed", () => {
    const call: RawToolCaller = vi.fn();
    const adapter = createMarketDataAdapter(call);
    expect(() => adapter.getEquityCurve()).toThrow(MissingCapabilityError);
    expect(call).not.toHaveBeenCalled();
  });
});

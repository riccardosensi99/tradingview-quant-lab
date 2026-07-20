import { describe, expect, it } from "vitest";
import {
  computeExposureTags,
  filterCorrelatedSetups,
  parseForexExposure,
} from "../scripts/risk/correlation-filter.js";

describe("parseForexExposure", () => {
  it("derives base/quote exposure for a long FX position", () => {
    expect(parseForexExposure("FX:EURUSD", "long")).toEqual({ EUR: 1, USD: -1 });
  });

  it("derives base/quote exposure for a short FX position", () => {
    expect(parseForexExposure("OANDA:USDCHF", "short")).toEqual({ USD: -1, CHF: 1 });
  });

  it("returns null for a non-6-letter ticker", () => {
    expect(parseForexExposure("NASDAQ:AAPL", "long")).toBeNull();
  });
});

describe("computeExposureTags", () => {
  it("uses explicit tags when provided, ignoring FX parsing", () => {
    expect(computeExposureTags("NYMEX:CL1!", "long", ["USD_commodity"])).toEqual(["USD_commodity"]);
  });

  it("falls back to symbol+direction for unrecognized non-FX symbols", () => {
    expect(computeExposureTags("NASDAQ:AAPL", "long")).toEqual(["NASDAQ:AAPL:long"]);
  });
});

describe("filterCorrelatedSetups", () => {
  it("keeps the highest-scoring setup among correlated USD exposures, per spec example", () => {
    // EURUSD long (EUR:long, USD:short) and USDCHF short (USD:short, CHF:long)
    // share USD:short exposure — the classic correlated-pair example from the spec.
    const result = filterCorrelatedSetups([
      { id: "eurusd-long", symbol: "FX:EURUSD", direction: "long", score: 82 },
      { id: "usdchf-short", symbol: "FX:USDCHF", direction: "short", score: 88 },
    ]);
    expect(result.kept.map((c) => c.id)).toEqual(["usdchf-short"]);
    expect(result.excluded).toEqual([
      { id: "eurusd-long", reason: expect.stringContaining("USD:short"), keptInstead: "usdchf-short" },
    ]);
  });

  it("keeps both setups when they share no exposure tag", () => {
    const result = filterCorrelatedSetups([
      { id: "eurusd-long", symbol: "FX:EURUSD", direction: "long", score: 82 },
      { id: "usdjpy-long", symbol: "FX:USDJPY", direction: "long", score: 80 },
    ]);
    // EURUSD long -> EUR:long, USD:short. USDJPY long -> USD:long, JPY:short. No overlap.
    expect(result.kept.map((c) => c.id).sort()).toEqual(["eurusd-long", "usdjpy-long"]);
    expect(result.excluded).toHaveLength(0);
  });
});

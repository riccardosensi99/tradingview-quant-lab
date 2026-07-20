import { describe, expect, it } from "vitest";
import { assembleScanInput } from "../scripts/scanner/assemble-scan-input.js";
import { runScan } from "../scripts/scanner/run-scan.js";
import { ScannerConfigSchema, RiskConfigSchema } from "../scripts/schemas/config.js";
import { makeStrategyEntry } from "./scanner-fixtures.js";

describe("assembleScanInput", () => {
  it("maps a real watchlist_get shape into symbolsPresent/symbolsAnalyzed", () => {
    const input = assembleScanInput({
      watchlistSymbols: [{ symbol: "FX:EURUSD" }, { symbol: "FX:USDJPY" }],
      watchlistName: "ric",
      chartSymbol: "FX:USDJPY",
      chartResolution: "60",
      registry: { strategies: [makeStrategyEntry({ status: "experimental" })] },
      scannerConfig: ScannerConfigSchema.parse({ max_bars_per_symbol: 100 }),
      riskConfig: RiskConfigSchema.parse({}),
      currency: "EUR",
      generatedAtUtc: "2026-07-20T18:00:00Z",
      generatedAtLocal: "2026-07-20T20:00:00+02:00",
    });
    expect(input.symbolsPresent).toEqual(["FX:EURUSD", "FX:USDJPY"]);
    expect(input.watchlistSource).toBe("watchlist:ric");
  });

  it("feeds correctly into runScan and produces NO TRADE when no strategy is validated", () => {
    const input = assembleScanInput({
      watchlistSymbols: [{ symbol: "FX:USDJPY" }],
      watchlistName: "ric",
      chartSymbol: "FX:USDJPY",
      chartResolution: "60",
      registry: { strategies: [makeStrategyEntry({ status: "experimental" })] },
      scannerConfig: ScannerConfigSchema.parse({ max_bars_per_symbol: 100 }),
      riskConfig: RiskConfigSchema.parse({}),
      currency: "EUR",
      generatedAtUtc: "2026-07-20T18:00:00Z",
      generatedAtLocal: "2026-07-20T20:00:00+02:00",
    });
    const result = runScan(input);
    expect(result.noTrade).toBe(true);
    expect(result.noTradeReasons[0]).toContain("No strategy");
  });
});

import { describe, expect, it } from "vitest";
import { runScan } from "../scripts/scanner/run-scan.js";
import { makeCandidate, makeScanInput, makeStrategyEntry } from "./scanner-fixtures.js";

describe("runScan", () => {
  it("returns NO TRADE when no strategy in the registry is validated (sr-volume-zones case)", () => {
    const input = makeScanInput({
      registry: { strategies: [makeStrategyEntry({ status: "experimental" })] },
    });
    const result = runScan(input);
    expect(result.noTrade).toBe(true);
    expect(result.noTradeReasons[0]).toContain("No strategy");
    expect(result.selectedSetups).toHaveLength(0);
  });

  it("selects a candidate referencing a validated strategy with a passing score", () => {
    const input = makeScanInput();
    const result = runScan(input);
    expect(result.noTrade).toBe(false);
    expect(result.selectedSetups.map((s) => s.id)).toEqual(["cand-1"]);
  });

  it("discards a candidate whose strategy is not validated even if its score is perfect", () => {
    const input = makeScanInput({
      registry: { strategies: [makeStrategyEntry({ id: "s2", status: "experimental" })] },
      candidates: [makeCandidate({ strategyId: "s2" })],
    });
    const result = runScan(input);
    expect(result.noTrade).toBe(true);
    expect(result.discardedSetups[0].reason).toContain('not status=validated');
  });

  it("applies the correlation filter across candidates sharing FX exposure", () => {
    const input = makeScanInput({
      registry: { strategies: [makeStrategyEntry({ symbol_universe: ["FX:EURUSD", "FX:USDCHF"] })] },
      candidates: [
        makeCandidate({ id: "eurusd-long", symbol: "FX:EURUSD", direction: "long" }),
        makeCandidate({
          id: "usdchf-short",
          symbol: "FX:USDCHF",
          direction: "short",
          scoreBreakdown: makeCandidate().scoreBreakdown, // same perfect score; tie broken by insertion order after sort stability
        }),
      ],
    });
    const result = runScan(input);
    // Both share USD:short exposure (EURUSD long -> USD:short; USDCHF short -> USD:short) — only one should remain.
    expect(result.selectedSetups).toHaveLength(1);
    expect(result.correlationExcluded).toHaveLength(1);
  });

  it("caps selected setups by aggregate risk and maximum_open_setups", () => {
    const manyStrategy = makeStrategyEntry({ symbol_universe: ["FX:EURUSD", "FX:GBPUSD", "FX:AUDUSD", "FX:NZDUSD"] });
    const input = makeScanInput({
      registry: { strategies: [manyStrategy] },
      candidates: [
        makeCandidate({ id: "a", symbol: "FX:EURUSD", direction: "long", riskPct: 0.6 }),
        makeCandidate({ id: "b", symbol: "FX:GBPUSD", direction: "short", riskPct: 0.6 }),
        makeCandidate({ id: "c", symbol: "FX:AUDUSD", direction: "long", riskPct: 0.6 }),
      ],
      riskConfig: { ...makeScanInput().riskConfig, max_total_risk_percent: 1.0, maximum_open_setups: 3 },
    });
    const result = runScan(input);
    // 0.6 + 0.6 = 1.2 > 1.0, so only 1 fits under the 1.0% cap (all have equal
    // score so the first processed wins; the cap is what's under test here).
    expect(result.totalRiskPct).toBeLessThanOrEqual(1.0);
    expect(result.selectedSetups.length).toBeLessThan(3);
  });

  it("returns NO TRADE when every eligible candidate is excluded by scoring", () => {
    const belowThreshold = makeCandidate({
      scoreBreakdown: { ...makeCandidate().scoreBreakdown, excluded: true, exclusionReason: "below min_score" },
    });
    const input = makeScanInput({ candidates: [belowThreshold] });
    const result = runScan(input);
    expect(result.noTrade).toBe(true);
  });
});

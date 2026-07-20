import { describe, expect, it } from "vitest";
import { runScan } from "../scripts/scanner/run-scan.js";
import { renderScanReportMarkdown } from "../scripts/scanner/report-markdown.js";
import { makeScanInput, makeStrategyEntry } from "./scanner-fixtures.js";

describe("renderScanReportMarkdown", () => {
  it("renders a NO TRADE section when there are no validated strategies", () => {
    const input = makeScanInput({ registry: { strategies: [makeStrategyEntry({ status: "experimental" })] } });
    const result = runScan(input);
    const markdown = renderScanReportMarkdown(result);
    expect(markdown).toContain("### NO TRADE");
    expect(markdown).toContain("Strategie validate disponibili:\nnessuna");
  });

  it("renders a selected setup section with score and risk fields", () => {
    const input = makeScanInput();
    const result = runScan(input);
    const markdown = renderScanReportMarkdown(result);
    expect(markdown).toContain("### Setup selezionati");
    expect(markdown).toContain("FX:EURUSD — LONG");
    expect(markdown).toContain("Score:\n100/100");
  });

  it("uses N/D for fields with no data rather than fabricating a value", () => {
    const input = makeScanInput();
    const result = runScan(input);
    const markdown = renderScanReportMarkdown(result);
    // The fixture candidate has no entryZone/trigger/session set.
    expect(markdown).toContain("Sessione:\nN/D");
  });
});

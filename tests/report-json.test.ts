import { describe, expect, it } from "vitest";
import { runScan } from "../scripts/scanner/run-scan.js";
import { toScanReportJson } from "../scripts/scanner/report-json.js";
import { makeScanInput } from "./scanner-fixtures.js";

describe("toScanReportJson", () => {
  it("is JSON-serializable and mirrors the scan result", () => {
    const input = makeScanInput();
    const result = runScan(input);
    const json = toScanReportJson(result);
    expect(() => JSON.stringify(json)).not.toThrow();
    expect(json.noTrade).toBe(false);
    expect(json.selectedSetups).toHaveLength(1);
    expect(json.validatedStrategies).toEqual(["s1"]);
  });
});

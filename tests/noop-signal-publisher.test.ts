import { describe, expect, it } from "vitest";
import { NoopSignalPublisher } from "../scripts/signals/noop-signal-publisher.js";
import { makeScanInput } from "./scanner-fixtures.js";
import type { ScanResult } from "../scripts/scanner/types.js";

describe("NoopSignalPublisher", () => {
  it("never reports published:true", async () => {
    const publisher = new NoopSignalPublisher();
    const result: ScanResult = {
      input: makeScanInput(),
      noTrade: true,
      noTradeReasons: ["No strategy validated"],
      selectedSetups: [],
      discardedSetups: [],
      correlationExcluded: [],
      aggregateRiskExcluded: [],
      totalRiskPct: 0,
    };
    const outcome = await publisher.publish(result);
    expect(outcome.published).toBe(false);
    expect(outcome.channel).toBe("noop");
    expect(outcome.detail).toContain("NO TRADE");
  });

  it("describes selected setups without sending anything, when the scan is not NO TRADE", async () => {
    const publisher = new NoopSignalPublisher();
    const scanInput = makeScanInput();
    const result: ScanResult = {
      input: scanInput,
      noTrade: false,
      noTradeReasons: [],
      selectedSetups: scanInput.candidates,
      discardedSetups: [],
      correlationExcluded: [],
      aggregateRiskExcluded: [],
      totalRiskPct: 0.5,
    };
    const outcome = await publisher.publish(result);
    expect(outcome.published).toBe(false);
    expect(outcome.detail).toContain("1 setup(s) selected");
  });
});

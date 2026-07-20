import { describe, expect, it } from "vitest";
import { renderValidationReport } from "../scripts/validation/validation-report.js";
import type { ClassificationResult } from "../scripts/validation/classify.js";

describe("renderValidationReport", () => {
  it("renders a criteria table reflecting the classification result", () => {
    const classification: ClassificationResult = {
      status: "validation_failed",
      rationale: "Failed 1 of 2 criteria: out_of_sample_profit_factor.",
      criteria: [
        { name: "out_of_sample_profit_factor", passed: false, detail: "0.969 vs minimum 1.2" },
        { name: "minimum_total_trades", passed: true, detail: "300 vs minimum 200" },
      ],
    };
    const markdown = renderValidationReport({
      strategyId: "sr-volume-zones",
      date: "2026-07-20",
      classification,
    });
    expect(markdown).toContain("status: validation_failed");
    expect(markdown).toContain("| out_of_sample_profit_factor | FAIL | 0.969 vs minimum 1.2 |");
    expect(markdown).toContain("| minimum_total_trades | PASS | 300 vs minimum 200 |");
  });

  it("handles an empty criteria list", () => {
    const markdown = renderValidationReport({
      strategyId: "x",
      date: "2026-01-01",
      classification: { status: "needs_more_data", rationale: "no data", criteria: [] },
    });
    expect(markdown).toContain("(no criteria evaluated)");
  });
});

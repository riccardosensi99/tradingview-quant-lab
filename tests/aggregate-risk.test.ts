import { describe, expect, it } from "vitest";
import { selectWithinAggregateRisk } from "../scripts/risk/aggregate-risk.js";

describe("selectWithinAggregateRisk", () => {
  const config = { maxTotalRiskPercent: 1.5, maximumOpenSetups: 3 };

  it("includes all candidates when under both caps", () => {
    const result = selectWithinAggregateRisk(
      [
        { id: "a", score: 90, riskPct: 0.5 },
        { id: "b", score: 85, riskPct: 0.5 },
      ],
      config,
    );
    expect(result.included.map((c) => c.id)).toEqual(["a", "b"]);
    expect(result.totalRiskPct).toBe(1);
  });

  it("excludes lower-score candidates once the risk cap would be exceeded", () => {
    const result = selectWithinAggregateRisk(
      [
        { id: "a", score: 90, riskPct: 0.5 },
        { id: "b", score: 85, riskPct: 0.5 },
        { id: "c", score: 80, riskPct: 0.6 }, // would push total to 1.6 > 1.5
      ],
      config,
    );
    expect(result.included.map((c) => c.id)).toEqual(["a", "b"]);
    expect(result.excluded.map((e) => e.id)).toEqual(["c"]);
    expect(result.totalRiskPct).toBe(1);
  });

  it("excludes beyond maximum_open_setups even if risk budget remains", () => {
    const result = selectWithinAggregateRisk(
      [
        { id: "a", score: 90, riskPct: 0.1 },
        { id: "b", score: 85, riskPct: 0.1 },
        { id: "c", score: 80, riskPct: 0.1 },
        { id: "d", score: 75, riskPct: 0.1 },
      ],
      config,
    );
    expect(result.included).toHaveLength(3);
    expect(result.excluded.map((e) => e.id)).toEqual(["d"]);
  });
});

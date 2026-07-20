import { describe, expect, it } from "vitest";
import { assessDirectionBalance } from "../scripts/validation/long-short.js";

describe("assessDirectionBalance", () => {
  it("flags concentration when one direction produces almost all the profit", () => {
    const result = assessDirectionBalance({ net_profit: 950 }, { net_profit: 50 });
    expect(result.longSharePct).toBeCloseTo(95);
    expect(result.dominantDirection).toBe("long");
    expect(result.concentrationWarning).toBe(true);
  });

  it("does not flag a roughly balanced split", () => {
    const result = assessDirectionBalance({ net_profit: 550 }, { net_profit: 450 });
    expect(result.dominantDirection).toBe("balanced");
    expect(result.concentrationWarning).toBe(false);
  });

  it("returns unknown when a direction's net_profit is missing", () => {
    const result = assessDirectionBalance({ net_profit: 100 }, undefined);
    expect(result.dominantDirection).toBe("unknown");
    expect(result.longSharePct).toBeNull();
  });
});

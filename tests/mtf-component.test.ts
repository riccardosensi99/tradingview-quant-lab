import { describe, expect, it } from "vitest";
import { scoreMtfAlignment } from "../scripts/scoring/mtf-component.js";

describe("scoreMtfAlignment", () => {
  it("full marks when htf and ltf directions match", () => {
    const result = scoreMtfAlignment({ htfDirection: "up", ltfDirection: "up" });
    expect(result.value).toBe(15);
  });

  it("zero when directions directly conflict", () => {
    const result = scoreMtfAlignment({ htfDirection: "up", ltfDirection: "down" });
    expect(result.value).toBe(0);
  });

  it("partial credit when one side is sideways", () => {
    const result = scoreMtfAlignment({ htfDirection: "sideways", ltfDirection: "up" });
    expect(result.value).toBe(8); // round(15 * 0.5)
  });

  it("zero when either direction is unknown", () => {
    expect(scoreMtfAlignment({ htfDirection: "unknown", ltfDirection: "up" }).value).toBe(0);
  });
});

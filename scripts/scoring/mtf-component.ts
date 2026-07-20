import { SCORE_COMPONENT_MAX, ScoreComponent } from "./types.js";

export type Direction = "up" | "down" | "sideways" | "unknown";

export interface MtfAlignmentInput {
  htfDirection: Direction;
  ltfDirection: Direction;
}

export function scoreMtfAlignment(input: MtfAlignmentInput): ScoreComponent {
  const max = SCORE_COMPONENT_MAX.multi_timeframe;

  if (input.htfDirection === "unknown" || input.ltfDirection === "unknown") {
    return {
      name: "multi_timeframe",
      value: 0,
      max,
      rationale: "Higher-timeframe or setup-timeframe direction could not be determined.",
      dataUsed: { ...input },
    };
  }

  if (input.htfDirection === input.ltfDirection) {
    return {
      name: "multi_timeframe",
      value: max,
      max,
      rationale: `Setup direction (${input.ltfDirection}) aligns with higher-timeframe direction (${input.htfDirection}).`,
      dataUsed: { ...input },
    };
  }

  if (input.htfDirection === "sideways" || input.ltfDirection === "sideways") {
    return {
      name: "multi_timeframe",
      value: Math.round(max * 0.5),
      max,
      rationale: "One timeframe is sideways relative to the other — partial alignment only.",
      dataUsed: { ...input },
    };
  }

  return {
    name: "multi_timeframe",
    value: 0,
    max,
    rationale: `Setup direction (${input.ltfDirection}) conflicts with higher-timeframe direction (${input.htfDirection}).`,
    dataUsed: { ...input },
  };
}

// Deterministic score aggregation (section 12/16): sums the 9 fixed
// components, applies penalties, and determines exclusion. Never adjusts a
// score to force a result to appear ("Non alterare il punteggio per forzare
// la presenza di operazioni") — this function only aggregates values the
// caller already computed and justified.

import { ExclusionFlags, Penalty, SCORE_COMPONENT_MAX, ScoreBreakdown, ScoreComponent, ScoreComponentName, ScoreTier } from "./types.js";

export interface ScoreComputationInput {
  components: ScoreComponent[];
  penalties: Penalty[];
  exclusionFlags: ExclusionFlags;
  minScore: number;
}

function scoreTier(finalScore: number): ScoreTier {
  if (finalScore >= 90) return "exceptional";
  if (finalScore >= 80) return "strong";
  if (finalScore >= 75) return "valid";
  return "below_75";
}

export function computeScore(input: ScoreComputationInput): ScoreBreakdown {
  const expectedNames = Object.keys(SCORE_COMPONENT_MAX) as ScoreComponentName[];
  const providedNames = input.components.map((c) => c.name);

  for (const name of expectedNames) {
    if (!providedNames.includes(name)) {
      throw new Error(`computeScore: missing required score component "${name}"`);
    }
  }
  if (providedNames.length !== expectedNames.length) {
    throw new Error("computeScore: duplicate score components provided");
  }

  for (const c of input.components) {
    const expectedMax = SCORE_COMPONENT_MAX[c.name];
    if (c.max !== expectedMax) {
      throw new Error(`computeScore: component "${c.name}" has max=${c.max}, expected ${expectedMax}`);
    }
    if (c.value < 0 || c.value > c.max) {
      throw new Error(`computeScore: component "${c.name}" value ${c.value} is outside [0, ${c.max}]`);
    }
  }

  const rawTotal = input.components.reduce((sum, c) => sum + c.value, 0);
  const penaltyTotal = input.penalties.reduce((sum, p) => sum + p.points, 0);
  const finalScore = Math.max(0, Math.min(100, rawTotal + penaltyTotal));

  const activeExclusions = Object.entries(input.exclusionFlags)
    .filter(([, v]) => v === true)
    .map(([k]) => k);
  const belowMinScore = finalScore < input.minScore;

  const excluded = activeExclusions.length > 0 || belowMinScore;
  const exclusionReason = excluded
    ? [
        ...activeExclusions,
        ...(belowMinScore ? [`finalScore ${finalScore} below min_score ${input.minScore}`] : []),
      ].join("; ")
    : undefined;

  return {
    components: input.components,
    penalties: input.penalties,
    rawTotal,
    finalScore,
    tier: scoreTier(finalScore),
    excluded,
    exclusionReason,
  };
}

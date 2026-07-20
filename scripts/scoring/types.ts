// Scoring types (research spec section 12). Component caps are fixed by the
// spec (they must sum to 100) — see scoring-engine.ts's own test that
// verifies this invariant.

export const SCORE_COMPONENT_MAX = {
  regime: 15,
  multi_timeframe: 15,
  level: 15,
  setup_confirmation: 15,
  volatility_liquidity: 10,
  volume: 10,
  risk_reward: 10,
  space: 5,
  session: 5,
} as const;
export type ScoreComponentName = keyof typeof SCORE_COMPONENT_MAX;

export interface ScoreComponent {
  name: ScoreComponentName;
  value: number;
  max: number;
  rationale: string;
  dataUsed: Record<string, unknown>;
}

export interface Penalty {
  name: string;
  /** Negative point delta. */
  points: number;
  rationale: string;
}

/** Hard exclusion gates (section 12: "Penalità" list items marked
 * "esclusione" rather than a point range). Any true flag removes the
 * candidate from the shown results regardless of its numeric score. */
export interface ExclusionFlags {
  insufficientData?: boolean;
  strategyNotValidated?: boolean;
  unsupportedProvider?: boolean;
  unsupportedTimeframe?: boolean;
  unsupportedRegime?: boolean;
  disorderedMarket?: boolean;
  correlationExcluded?: boolean;
  insufficientRiskReward?: boolean;
  staleData?: boolean;
  triggerNotConfirmed?: boolean;
  htfConflict?: boolean;
}

export type ScoreTier = "exceptional" | "strong" | "valid" | "below_75";

export interface ScoreBreakdown {
  components: ScoreComponent[];
  penalties: Penalty[];
  rawTotal: number;
  finalScore: number;
  tier: ScoreTier;
  excluded: boolean;
  exclusionReason?: string;
}

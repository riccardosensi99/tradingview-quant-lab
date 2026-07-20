// Risk/reward and position-sizing math (research spec section 13). Pure
// geometry — no data is inferred beyond what's passed in. Per spec:
// "La size teorica deve essere calcolata solamente se è stato fornito
// account-size" — computePositionSize returns nulls, not a fabricated
// default account size, when none is given.

export interface RiskRewardInput {
  entry: number;
  stop: number;
  target1: number;
  target2?: number;
}

export interface RiskRewardResult {
  riskDistance: number;
  rrToT1: number;
  rrToT2: number | null;
}

export function computeRiskReward(input: RiskRewardInput): RiskRewardResult {
  const riskDistance = Math.abs(input.entry - input.stop);
  if (riskDistance === 0) {
    throw new Error("computeRiskReward: entry and stop are equal — risk distance is zero");
  }
  return {
    riskDistance,
    rrToT1: Math.abs(input.target1 - input.entry) / riskDistance,
    rrToT2: input.target2 !== undefined ? Math.abs(input.target2 - input.entry) / riskDistance : null,
  };
}

export interface PositionSizeInput {
  accountSize?: number;
  riskPerTradePct: number;
  entry: number;
  stop: number;
}

export interface PositionSizeResult {
  size: number | null;
  monetaryRisk: number | null;
  reason?: string;
}

export function computePositionSize(input: PositionSizeInput): PositionSizeResult {
  if (input.accountSize === undefined) {
    return {
      size: null,
      monetaryRisk: null,
      reason: "account-size not provided — theoretical size is not calculated (spec section 13)",
    };
  }
  const riskDistance = Math.abs(input.entry - input.stop);
  if (riskDistance === 0) {
    throw new Error("computePositionSize: entry and stop are equal — cannot size a trade with zero risk distance");
  }
  const monetaryRisk = input.accountSize * (input.riskPerTradePct / 100);
  return { size: monetaryRisk / riskDistance, monetaryRisk };
}

// Pure derivations of expectancy, payoff ratio, and recovery factor from
// primitive metrics already present on a real backtest result. These throw
// on undefined ratios (e.g. zero drawdown) rather than returning
// Infinity/NaN silently.

export function computeExpectancy(winRatePct: number, avgWin: number, avgLoss: number): number {
  const winRate = winRatePct / 100;
  return winRate * avgWin - (1 - winRate) * Math.abs(avgLoss);
}

export function computePayoffRatio(avgWin: number, avgLoss: number): number {
  if (avgLoss === 0) {
    throw new Error("computePayoffRatio: avgLoss is zero — payoff ratio is undefined");
  }
  return avgWin / Math.abs(avgLoss);
}

export function computeRecoveryFactor(netProfit: number, maxDrawdownPct: number): number {
  if (maxDrawdownPct === 0) {
    throw new Error("computeRecoveryFactor: maxDrawdownPct is zero — recovery factor is undefined");
  }
  return netProfit / Math.abs(maxDrawdownPct);
}

// Portfolio-level risk cap (research spec section 13): "rischio aggregato
// massimo: 1.5%; massimo 3 setup". Greedily fills from highest score down,
// excluding whatever would breach either cap — never silently trims risk by
// shrinking a position size.

export interface RiskCandidate {
  id: string;
  score: number;
  riskPct: number;
}

export interface AggregateRiskConfig {
  maxTotalRiskPercent: number;
  maximumOpenSetups: number;
}

export interface AggregateRiskResult {
  included: RiskCandidate[];
  excluded: { id: string; reason: string }[];
  totalRiskPct: number;
}

export function selectWithinAggregateRisk(
  candidates: RiskCandidate[],
  config: AggregateRiskConfig,
): AggregateRiskResult {
  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const included: RiskCandidate[] = [];
  const excluded: { id: string; reason: string }[] = [];
  let totalRisk = 0;

  for (const c of sorted) {
    if (included.length >= config.maximumOpenSetups) {
      excluded.push({ id: c.id, reason: `maximum_open_setups (${config.maximumOpenSetups}) already reached` });
      continue;
    }
    if (totalRisk + c.riskPct > config.maxTotalRiskPercent) {
      excluded.push({
        id: c.id,
        reason: `would exceed max_total_risk_percent (${config.maxTotalRiskPercent}%): ${totalRisk}% + ${c.riskPct}% > ${config.maxTotalRiskPercent}%`,
      });
      continue;
    }
    included.push(c);
    totalRisk += c.riskPct;
  }

  return { included, excluded, totalRiskPct: totalRisk };
}

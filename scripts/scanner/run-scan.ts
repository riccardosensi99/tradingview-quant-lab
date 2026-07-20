// Scanner orchestration (research spec section 9-13): validated-strategy
// gating, correlation filtering, aggregate-risk capping, ranking, and the
// NO TRADE fallback. Operates on already-scored CandidateSetup objects — see
// scripts/scanner/types.ts for why (the live evidence gathering happens in
// the calling skill via scripts/adapter/, not here).

import { filterCorrelatedSetups } from "../risk/correlation-filter.js";
import { selectWithinAggregateRisk } from "../risk/aggregate-risk.js";
import type { CandidateSetup, DiscardedSetup, ScanInput, ScanResult } from "./types.js";

function findCandidate(candidates: CandidateSetup[], id: string): CandidateSetup {
  const found = candidates.find((c) => c.id === id);
  if (!found) throw new Error(`runScan: internal inconsistency — candidate "${id}" not found`);
  return found;
}

export function runScan(input: ScanInput): ScanResult {
  const validatedStrategyIds = new Set(
    input.registry.strategies.filter((s) => s.status === "validated").map((s) => s.id),
  );
  const noValidatedStrategies = validatedStrategyIds.size === 0;

  const eligible = input.candidates.filter(
    (c) => validatedStrategyIds.has(c.strategyId) && !c.scoreBreakdown.excluded,
  );

  const discardedFromGating: DiscardedSetup[] = input.candidates
    .filter((c) => !(validatedStrategyIds.has(c.strategyId) && !c.scoreBreakdown.excluded))
    .map((c) => ({
      symbol: c.symbol,
      direction: c.direction,
      strategyId: c.strategyId,
      score: c.scoreBreakdown.finalScore,
      reason: !validatedStrategyIds.has(c.strategyId)
        ? `strategy "${c.strategyId}" is not status=validated`
        : (c.scoreBreakdown.exclusionReason ?? "excluded"),
    }));

  if (eligible.length === 0) {
    const reasons: string[] = [];
    if (noValidatedStrategies) {
      reasons.push(
        "No strategy in strategies/registry.yaml has status=validated — the scanner cannot propose operational setups (require_validated_strategy).",
      );
    } else {
      reasons.push("No candidate met the minimum score / exclusion criteria.");
    }
    return {
      input,
      noTrade: true,
      noTradeReasons: reasons,
      selectedSetups: [],
      discardedSetups: discardedFromGating,
      correlationExcluded: [],
      aggregateRiskExcluded: [],
      totalRiskPct: 0,
    };
  }

  const correlationResult = input.scannerConfig.filters.correlation_filter
    ? filterCorrelatedSetups(
        eligible.map((c) => ({
          id: c.id,
          symbol: c.symbol,
          direction: c.direction,
          score: c.scoreBreakdown.finalScore,
          exposureTags: c.exposureTags,
        })),
      )
    : { kept: eligible.map((c) => ({ id: c.id })), excluded: [] as { id: string; reason: string; keptInstead: string }[] };

  const keptIds = new Set(correlationResult.kept.map((k) => k.id));
  const afterCorrelation = eligible.filter((c) => keptIds.has(c.id));

  const aggregateResult = selectWithinAggregateRisk(
    afterCorrelation.map((c) => ({ id: c.id, score: c.scoreBreakdown.finalScore, riskPct: c.riskPct })),
    {
      maxTotalRiskPercent: input.riskConfig.max_total_risk_percent,
      maximumOpenSetups: Math.min(input.riskConfig.maximum_open_setups, input.scannerConfig.max_results),
    },
  );
  const includedIds = new Set(aggregateResult.included.map((i) => i.id));
  const finalSetups = afterCorrelation
    .filter((c) => includedIds.has(c.id))
    .sort((a, b) => b.scoreBreakdown.finalScore - a.scoreBreakdown.finalScore);

  const discardedSetups: DiscardedSetup[] = [
    ...discardedFromGating,
    ...correlationResult.excluded.map((e) => {
      const c = findCandidate(eligible, e.id);
      return { symbol: c.symbol, direction: c.direction, strategyId: c.strategyId, score: c.scoreBreakdown.finalScore, reason: e.reason };
    }),
    ...aggregateResult.excluded.map((e) => {
      const c = findCandidate(afterCorrelation, e.id);
      return { symbol: c.symbol, direction: c.direction, strategyId: c.strategyId, score: c.scoreBreakdown.finalScore, reason: e.reason };
    }),
  ];

  if (finalSetups.length === 0) {
    return {
      input,
      noTrade: true,
      noTradeReasons: ["All eligible candidates were excluded by correlation or aggregate-risk filtering."],
      selectedSetups: [],
      discardedSetups,
      correlationExcluded: correlationResult.excluded,
      aggregateRiskExcluded: aggregateResult.excluded,
      totalRiskPct: 0,
    };
  }

  return {
    input,
    noTrade: false,
    noTradeReasons: [],
    selectedSetups: finalSetups,
    discardedSetups,
    correlationExcluded: correlationResult.excluded,
    aggregateRiskExcluded: aggregateResult.excluded,
    totalRiskPct: aggregateResult.totalRiskPct,
  };
}

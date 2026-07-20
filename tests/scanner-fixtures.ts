import { SCORE_COMPONENT_MAX, ScoreComponent } from "../scripts/scoring/types.js";
import { computeScore } from "../scripts/scoring/scoring-engine.js";
import { ScannerConfigSchema, RiskConfigSchema } from "../scripts/schemas/config.js";
import type { StrategyRegistry, StrategyRegistryEntry } from "../scripts/schemas/registry.js";
import type { CandidateSetup, ScanInput } from "../scripts/scanner/types.js";

export function fullMarksComponents(overrides: Partial<Record<string, number>> = {}): ScoreComponent[] {
  return (Object.keys(SCORE_COMPONENT_MAX) as (keyof typeof SCORE_COMPONENT_MAX)[]).map((name) => ({
    name,
    value: overrides[name] ?? SCORE_COMPONENT_MAX[name],
    max: SCORE_COMPONENT_MAX[name],
    rationale: "fixture",
    dataUsed: {},
  }));
}

export function makeStrategyEntry(overrides: Partial<StrategyRegistryEntry> = {}): StrategyRegistryEntry {
  return {
    id: "s1",
    name: "S1",
    pine_script_id: "USER;s1",
    status: "validated",
    stage: "live",
    symbol_universe: ["FX:EURUSD"],
    timeframe: "60",
    created: "2026-01-01",
    last_updated: "2026-01-01",
    metrics: {
      net_profit_pct: 1,
      profit_factor: 1.5,
      max_drawdown_pct: 5,
      sharpe_ratio: 1,
      sortino_ratio: 1,
      total_trades: 250,
      win_rate_pct: 55,
    },
    reports: { backtests: [], validations: [] },
    ...overrides,
  };
}

export function makeCandidate(overrides: Partial<CandidateSetup> = {}): CandidateSetup {
  const scoreBreakdown = computeScore({
    components: fullMarksComponents(),
    penalties: [],
    exclusionFlags: {},
    minScore: 75,
  });
  return {
    id: overrides.id ?? "cand-1",
    symbol: "FX:EURUSD",
    direction: "long",
    strategyId: "s1",
    timeframeOperativo: "60",
    regime: { regime: "strong_trend", confidence: 0.9, metricsUsed: [], conflicts: [] },
    triggerConfirmed: true,
    riskPct: 0.5,
    scoreBreakdown,
    rationale: [],
    risks: [],
    invalidationConditions: [],
    dataStale: false,
    ...overrides,
  };
}

export function makeScanInput(overrides: Partial<ScanInput> = {}): ScanInput {
  const registry: StrategyRegistry = overrides.registry ?? { strategies: [makeStrategyEntry()] };
  return {
    generatedAtUtc: "2026-07-20T18:00:00Z",
    generatedAtLocal: "2026-07-20T20:00:00+02:00",
    watchlistSource: "watchlist:test",
    symbolsPresent: ["FX:EURUSD"],
    symbolsAnalyzed: ["FX:EURUSD"],
    excludedSymbols: [],
    timeframesRequested: ["60"],
    timeframesAvailable: ["60"],
    mode: "conservative",
    registry,
    scannerConfig: ScannerConfigSchema.parse({ max_bars_per_symbol: 100 }),
    riskConfig: RiskConfigSchema.parse({}),
    currency: "EUR",
    candidates: [makeCandidate()],
    auditLog: [],
    mcpLimitations: [],
    tradingviewLimitations: [],
    ...overrides,
  };
}

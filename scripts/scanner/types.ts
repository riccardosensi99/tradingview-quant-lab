import type { ScannerConfig, RiskConfig } from "../schemas/config.js";
import type { StrategyRegistry } from "../schemas/registry.js";
import type { RegimeClassification } from "../regime/types.js";
import type { ScoreBreakdown } from "../scoring/types.js";
import type { AuditEntry } from "../adapter/audit.js";

export type Direction = "long" | "short";

/** A fully-evaluated candidate — score, risk math, and regime read must
 * already be computed by the caller (using scripts/scoring, scripts/risk,
 * scripts/regime) before it reaches the scanner orchestrator. This module
 * ranks/filters/reports; it does not derive evidence from raw data itself. */
export interface CandidateSetup {
  id: string;
  symbol: string;
  direction: Direction;
  strategyId: string;
  strategyVersion?: string;
  timeframeOperativo: string;
  contextHtf?: string;
  regime: RegimeClassification;
  session?: string;
  provider?: string;
  timestampData?: string;
  entryZone?: string;
  trigger?: string;
  triggerConfirmed: boolean;
  stopLoss?: number;
  invalidation?: string;
  target1?: number;
  target2?: number;
  entry?: number;
  riskRewardT1?: number;
  riskRewardT2?: number | null;
  riskPct: number;
  monetaryRisk?: number | null;
  theoreticalSize?: number | null;
  estimatedDuration?: string;
  expiry?: string;
  scoreBreakdown: ScoreBreakdown;
  exposureTags?: string[];
  rationale: string[];
  risks: string[];
  invalidationConditions: string[];
  dataStale: boolean;
}

export interface ExcludedSymbolInfo {
  symbol: string;
  reason: string;
}

export interface DiscardedSetup {
  symbol: string;
  direction: Direction;
  strategyId?: string;
  score?: number;
  reason: string;
  futureCondition?: string;
}

export interface ScanInput {
  generatedAtUtc: string;
  generatedAtLocal: string;
  watchlistSource: string;
  symbolsPresent: string[];
  symbolsAnalyzed: string[];
  excludedSymbols: ExcludedSymbolInfo[];
  timeframesRequested: string[];
  timeframesAvailable: string[];
  mode: string;
  registry: StrategyRegistry;
  scannerConfig: ScannerConfig;
  riskConfig: RiskConfig;
  accountSize?: number;
  currency: string;
  candidates: CandidateSetup[];
  auditLog: readonly AuditEntry[];
  mcpLimitations: string[];
  tradingviewLimitations: string[];
}

export interface ScanResult {
  input: ScanInput;
  noTrade: boolean;
  noTradeReasons: string[];
  selectedSetups: CandidateSetup[];
  discardedSetups: DiscardedSetup[];
  correlationExcluded: { id: string; reason: string; keptInstead: string }[];
  aggregateRiskExcluded: { id: string; reason: string }[];
  totalRiskPct: number;
}

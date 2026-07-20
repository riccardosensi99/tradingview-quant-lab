// Builds a ScanInput from real, already-fetched MCP reads (watchlist_get,
// chart_get_state) plus the registry/config already validated elsewhere in
// this codebase. This module does not call MCP tools itself (see
// scripts/adapter/) and does not score candidates — it only assembles the
// context the scanner needs. Candidate evaluation (regime + scoring per
// symbol) is intentionally out of scope here until that live per-symbol
// data-gathering step exists; when no validated strategy is available in the
// registry, runScan() correctly returns NO TRADE regardless.

import type { RiskConfig, ScannerConfig } from "../schemas/config.js";
import type { StrategyRegistry } from "../schemas/registry.js";
import type { AuditEntry } from "../adapter/audit.js";
import type { CandidateSetup, ScanInput } from "./types.js";

export interface RawWatchlistSymbol {
  symbol: string;
}

export interface AssembleScanInputParams {
  watchlistSymbols: RawWatchlistSymbol[];
  watchlistName: string;
  chartSymbol: string;
  chartResolution: string;
  registry: StrategyRegistry;
  scannerConfig: ScannerConfig;
  riskConfig: RiskConfig;
  currency: string;
  generatedAtUtc: string;
  generatedAtLocal: string;
  candidates?: CandidateSetup[];
  auditLog?: AuditEntry[];
  mcpLimitations?: string[];
  tradingviewLimitations?: string[];
}

export function assembleScanInput(params: AssembleScanInputParams): ScanInput {
  const symbolsPresent = params.watchlistSymbols.map((s) => s.symbol);
  const timeframesRequested =
    params.scannerConfig.timeframes.length > 0 ? params.scannerConfig.timeframes : [params.chartResolution];

  return {
    generatedAtUtc: params.generatedAtUtc,
    generatedAtLocal: params.generatedAtLocal,
    watchlistSource: `watchlist:${params.watchlistName}`,
    symbolsPresent,
    symbolsAnalyzed: symbolsPresent,
    excludedSymbols: [],
    timeframesRequested,
    timeframesAvailable: [params.chartResolution],
    mode: params.scannerConfig.mode,
    registry: params.registry,
    scannerConfig: params.scannerConfig,
    riskConfig: params.riskConfig,
    currency: params.currency,
    candidates: params.candidates ?? [],
    auditLog: params.auditLog ?? [],
    mcpLimitations: params.mcpLimitations ?? [],
    tradingviewLimitations: params.tradingviewLimitations ?? [],
  };
}

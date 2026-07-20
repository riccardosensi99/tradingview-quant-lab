// JSON scan report — a leaner projection of ScanResult (not the full
// registry/config, which are already versioned separately) for
// reports/scans/<...>.json, per config/scanner.yaml's reporting.save_json.

import type { ScanResult } from "./types.js";

export interface ScanReportJson {
  generatedAtUtc: string;
  generatedAtLocal: string;
  watchlistSource: string;
  symbolsPresent: number;
  symbolsAnalyzed: number;
  excludedSymbols: { symbol: string; reason: string }[];
  mode: string;
  validatedStrategies: string[];
  noTrade: boolean;
  noTradeReasons: string[];
  selectedSetups: unknown[];
  discardedSetups: unknown[];
  correlationExcluded: unknown[];
  aggregateRiskExcluded: unknown[];
  totalRiskPct: number;
  mcpToolsUsed: string[];
  mcpLimitations: string[];
  tradingviewLimitations: string[];
}

export function toScanReportJson(result: ScanResult): ScanReportJson {
  const { input } = result;
  return {
    generatedAtUtc: input.generatedAtUtc,
    generatedAtLocal: input.generatedAtLocal,
    watchlistSource: input.watchlistSource,
    symbolsPresent: input.symbolsPresent.length,
    symbolsAnalyzed: input.symbolsAnalyzed.length,
    excludedSymbols: input.excludedSymbols,
    mode: input.mode,
    validatedStrategies: input.registry.strategies.filter((s) => s.status === "validated").map((s) => s.id),
    noTrade: result.noTrade,
    noTradeReasons: result.noTradeReasons,
    selectedSetups: result.selectedSetups,
    discardedSetups: result.discardedSetups,
    correlationExcluded: result.correlationExcluded,
    aggregateRiskExcluded: result.aggregateRiskExcluded,
    totalRiskPct: result.totalRiskPct,
    mcpToolsUsed: [...new Set(input.auditLog.map((e) => e.tool))],
    mcpLimitations: input.mcpLimitations,
    tradingviewLimitations: input.tradingviewLimitations,
  };
}

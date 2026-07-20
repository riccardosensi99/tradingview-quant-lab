// Portfolio-survey analysis of strategies/registry.yaml for
// tradingview-strategy-generator — grouping, gap detection, and family
// concentration, all pure functions over an already-loaded StrategyRegistry.
// Never calls MCP, never touches disk. See
// .claude/skills/tradingview-strategy-generator/generation-protocol.md for
// the method this implements.

import { MARKET_REGIMES } from "../regime/types.js";
import type { StrategyRegistry, StrategyRegistryEntry } from "../schemas/registry.js";

const UNSPECIFIED = "unspecified";

/** A family is flagged only once it has at least 2 entries AND its share of
 * the registry exceeds this threshold — a single-entry family in a small
 * registry isn't "overrepresented," it's just the only data point yet. */
export const OVERREPRESENTATION_SHARE_THRESHOLD = 0.4;

export interface RegistryGapAnalysis {
  totalStrategies: number;
  byStatus: Record<string, number>;
  byFamily: Record<string, number>;
  byMarket: Record<string, number>;
  byTimeframe: Record<string, number>;
  byRegime: Record<string, number>;
  bySession: Record<string, number>;
  byDirection: Record<string, number>;
  needsMoreDataIds: string[];
  overrepresentedFamilies: string[];
  gaps: string[];
}

function increment(bucket: Record<string, number>, key: string): void {
  bucket[key] = (bucket[key] ?? 0) + 1;
}

/** Exchange prefix of an "EXCHANGE:SYMBOL" ticker, e.g. "FX:USDJPY" -> "FX".
 * Falls back to `UNSPECIFIED` for a malformed or missing ticker rather than
 * guessing a market. */
function marketOf(symbol: string): string {
  const idx = symbol.indexOf(":");
  return idx > 0 ? symbol.slice(0, idx) : UNSPECIFIED;
}

function tallyEntry(entry: StrategyRegistryEntry, gaps: {
  byStatus: Record<string, number>;
  byFamily: Record<string, number>;
  byMarket: Record<string, number>;
  byTimeframe: Record<string, number>;
  byRegime: Record<string, number>;
  bySession: Record<string, number>;
  byDirection: Record<string, number>;
}): void {
  increment(gaps.byStatus, entry.status);
  increment(gaps.byFamily, entry.family ?? UNSPECIFIED);
  increment(gaps.byTimeframe, entry.timeframe);

  const markets = new Set(entry.symbol_universe.map(marketOf));
  if (markets.size === 0) markets.add(UNSPECIFIED);
  for (const market of markets) increment(gaps.byMarket, market);

  if (entry.regimes_supported && entry.regimes_supported.length > 0) {
    for (const regime of entry.regimes_supported) increment(gaps.byRegime, regime);
  } else {
    increment(gaps.byRegime, UNSPECIFIED);
  }

  if (entry.sessions_supported && entry.sessions_supported.length > 0) {
    for (const session of entry.sessions_supported) increment(gaps.bySession, session);
  } else {
    increment(gaps.bySession, UNSPECIFIED);
  }

  if (entry.directions_supported && entry.directions_supported.length > 0) {
    for (const direction of entry.directions_supported) increment(gaps.byDirection, direction);
  } else {
    increment(gaps.byDirection, UNSPECIFIED);
  }
}

function findOverrepresentedFamilies(byFamily: Record<string, number>, totalStrategies: number): string[] {
  return Object.entries(byFamily)
    .filter(([family, count]) => family !== UNSPECIFIED && count >= 2 && count / totalStrategies > OVERREPRESENTATION_SHARE_THRESHOLD)
    .map(([family]) => family);
}

function computeGaps(
  totalStrategies: number,
  byStatus: Record<string, number>,
  byFamily: Record<string, number>,
  byDirection: Record<string, number>,
  byRegime: Record<string, number>,
  bySession: Record<string, number>,
  overrepresentedFamilies: string[],
): string[] {
  if (totalStrategies === 0) {
    return ["empty registry — no coverage data; any well-formed hypothesis is a legitimate first entry"];
  }

  const gaps: string[] = [];

  if (!byStatus.validated || byStatus.validated === 0) {
    gaps.push("no validated strategies yet — every entry is still experimental/needs_more_data/rejected or earlier");
  }

  if (!byDirection.long) gaps.push("no long-direction strategy");
  if (!byDirection.short) gaps.push("no short-direction strategy");

  for (const regime of MARKET_REGIMES) {
    if (!byRegime[regime]) gaps.push(`no strategy targets regime=${regime}`);
  }

  const sessionKeys = Object.keys(bySession);
  if (sessionKeys.length === 1 && sessionKeys[0] === UNSPECIFIED) {
    gaps.push("no strategy declares session coverage — sessions_supported is unset on every entry");
  }

  const distinctFamilies = Object.keys(byFamily).filter((f) => f !== UNSPECIFIED).length;
  if (distinctFamilies === 0) {
    gaps.push("no strategy declares a family — family diversity cannot be assessed");
  } else if (totalStrategies >= 3 && distinctFamilies === 1) {
    gaps.push("only one distinct family present across the registry — low family diversity");
  }

  for (const family of overrepresentedFamilies) {
    gaps.push(`family=${family} is overrepresented relative to the rest of the registry`);
  }

  return gaps;
}

export function analyzeRegistryGaps(registry: StrategyRegistry): RegistryGapAnalysis {
  const byStatus: Record<string, number> = {};
  const byFamily: Record<string, number> = {};
  const byMarket: Record<string, number> = {};
  const byTimeframe: Record<string, number> = {};
  const byRegime: Record<string, number> = {};
  const bySession: Record<string, number> = {};
  const byDirection: Record<string, number> = {};
  const needsMoreDataIds: string[] = [];

  for (const entry of registry.strategies) {
    tallyEntry(entry, { byStatus, byFamily, byMarket, byTimeframe, byRegime, bySession, byDirection });
    if (entry.status === "needs_more_data") needsMoreDataIds.push(entry.id);
  }

  const totalStrategies = registry.strategies.length;
  const overrepresentedFamilies = totalStrategies === 0 ? [] : findOverrepresentedFamilies(byFamily, totalStrategies);
  const gaps = computeGaps(totalStrategies, byStatus, byFamily, byDirection, byRegime, bySession, overrepresentedFamilies);

  return {
    totalStrategies,
    byStatus,
    byFamily,
    byMarket,
    byTimeframe,
    byRegime,
    bySession,
    byDirection,
    needsMoreDataIds,
    overrepresentedFamilies,
    gaps,
  };
}

// Correlation filter (research spec section 11). Automatic exposure
// derivation only works for standard 6-letter FX tickers (base+quote is
// unambiguous from the symbol alone). For anything else (indices,
// commodities, crypto), this module does NOT guess a correlation — it
// requires the caller to supply `exposureTags` explicitly (e.g. from a
// configured correlation-group mapping); without them, a non-FX symbol is
// only considered correlated with an identical symbol+direction repeat.

export type Direction = "long" | "short";

export function parseForexExposure(symbol: string, direction: Direction): Record<string, 1 | -1> | null {
  const ticker = symbol.includes(":") ? symbol.split(":")[1] : symbol;
  if (!/^[A-Za-z]{6}$/.test(ticker)) return null;
  const base = ticker.slice(0, 3).toUpperCase();
  const quote = ticker.slice(3, 6).toUpperCase();
  const sign: 1 | -1 = direction === "long" ? 1 : -1;
  return { [base]: sign, [quote]: (sign * -1) as 1 | -1 };
}

export function computeExposureTags(symbol: string, direction: Direction, explicitTags?: string[]): string[] {
  if (explicitTags && explicitTags.length > 0) return explicitTags;
  const fx = parseForexExposure(symbol, direction);
  if (fx) {
    return Object.entries(fx).map(([currency, sign]) => `${currency}:${sign > 0 ? "long" : "short"}`);
  }
  return [`${symbol}:${direction}`];
}

export interface CorrelationCandidate {
  id: string;
  symbol: string;
  direction: Direction;
  score: number;
  exposureTags?: string[];
}

export interface CorrelationFilterResult {
  kept: CorrelationCandidate[];
  excluded: { id: string; reason: string; keptInstead: string }[];
}

/** Groups candidates sharing any exposure tag and keeps only the
 * highest-scoring one per group — "preferire quello con [...] score
 * maggiore" (section 11). */
export function filterCorrelatedSetups(candidates: CorrelationCandidate[]): CorrelationFilterResult {
  const withTags = candidates.map((c) => ({ ...c, tags: computeExposureTags(c.symbol, c.direction, c.exposureTags) }));
  const sorted = [...withTags].sort((a, b) => b.score - a.score);

  const kept: CorrelationCandidate[] = [];
  const excluded: { id: string; reason: string; keptInstead: string }[] = [];
  const claimedBy = new Map<string, (typeof withTags)[number]>();

  for (const candidate of sorted) {
    const holder = candidate.tags.map((t) => claimedBy.get(t)).find((h) => h !== undefined);
    if (holder) {
      excluded.push({
        id: candidate.id,
        reason: `shares exposure tag(s) with ${holder.id}: ${candidate.tags.join(", ")}`,
        keptInstead: holder.id,
      });
      continue;
    }
    kept.push(candidate);
    for (const tag of candidate.tags) claimedBy.set(tag, candidate);
  }

  return { kept, excluded };
}

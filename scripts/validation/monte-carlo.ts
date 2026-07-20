// Trade-order Monte Carlo: reshuffles a REAL sequence of per-trade P&L
// values (reconstructed from data_get_trades fills — see monte-carlo.md) to
// build a distribution of max drawdown and final equity. This resamples
// real trades; it never fabricates a trade that wasn't actually in the
// input, per "Non simulare risultati mancanti".

export interface MonteCarloOptions {
  simulations: number;
  /** If provided, tracks the fraction of simulations whose cumulative
   * equity ever drops to or below this value. */
  ruinThreshold?: number;
  /** Injectable RNG in [0, 1) for deterministic tests. Defaults to Math.random. */
  rng?: () => number;
}

export interface MonteCarloResult {
  simulations: number;
  maxDrawdownPercentiles: { p5: number; p50: number; p95: number };
  finalEquityPercentiles: { p5: number; p50: number; p95: number };
  probabilityOfRuin: number | null;
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function shuffle(values: number[], rng: () => number): number[] {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Seeded PRNG (mulberry32) for reproducible tests — not for production
 * randomness guarantees, just determinism. */
export function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function runTradeOrderMonteCarlo(tradePnls: number[], options: MonteCarloOptions): MonteCarloResult {
  if (tradePnls.length === 0) {
    throw new Error(
      "runTradeOrderMonteCarlo requires at least one real trade P&L value — trades cannot be fabricated",
    );
  }
  if (options.simulations <= 0) {
    throw new Error("runTradeOrderMonteCarlo: simulations must be a positive integer");
  }

  const rng = options.rng ?? Math.random;
  const drawdowns: number[] = [];
  const finals: number[] = [];
  let ruinCount = 0;

  for (let i = 0; i < options.simulations; i++) {
    const order = shuffle(tradePnls, rng);
    let equity = 0;
    let peak = 0;
    let maxDrawdown = 0;
    for (const pnl of order) {
      equity += pnl;
      peak = Math.max(peak, equity);
      maxDrawdown = Math.max(maxDrawdown, peak - equity);
      if (options.ruinThreshold !== undefined && equity <= options.ruinThreshold) {
        ruinCount++;
        break;
      }
    }
    drawdowns.push(maxDrawdown);
    finals.push(equity);
  }

  drawdowns.sort((a, b) => a - b);
  finals.sort((a, b) => a - b);

  return {
    simulations: options.simulations,
    maxDrawdownPercentiles: {
      p5: percentile(drawdowns, 5),
      p50: percentile(drawdowns, 50),
      p95: percentile(drawdowns, 95),
    },
    finalEquityPercentiles: {
      p5: percentile(finals, 5),
      p50: percentile(finals, 50),
      p95: percentile(finals, 95),
    },
    probabilityOfRuin: options.ruinThreshold !== undefined ? ruinCount / options.simulations : null,
  };
}

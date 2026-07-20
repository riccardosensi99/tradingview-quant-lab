// Market regime classification (research spec section 7). Regime names are
// exactly the 8 categories the spec lists — no additional categories are
// invented, and directionality (up/down) is deliberately kept as a separate
// field rather than folded into the regime name.

export const MARKET_REGIMES = [
  "strong_trend",
  "weak_trend",
  "range",
  "breakout_expansion",
  "volatility_compression",
  "high_volatility_disorder",
  "illiquid_noisy",
  "uncertain",
] as const;
export type MarketRegime = (typeof MARKET_REGIMES)[number];

/**
 * Metrics that feed the classifier. All optional: this repo's MCP adapter
 * (scripts/adapter/) only exposes whatever indicators are already visible on
 * the user's chart (the skills never add indicators — hard constraint), so a
 * given scan may have only a subset of these available. Values are expected
 * to already be computed (e.g. by TradingView's own studies, read via
 * data_get_study_values) — this module does not compute ADX/ATR/etc. from
 * raw OHLCV itself.
 */
export interface RegimeInputMetrics {
  structureTrend?: "HH_HL" | "LH_LL" | "mixed";
  maSlopePct?: number;
  distanceFromMaPct?: number;
  adx?: number;
  atr?: number;
  /** 0-100. Percentile rank of current ATR vs. its own recent history. */
  atrPercentile?: number;
  bollingerBandWidthPct?: number;
  /** 0-1, Kaufman-style efficiency ratio (net move / sum of absolute moves). */
  efficiencyRatio?: number;
  /** 1.0 = average volume. */
  relativeVolume?: number;
  sessionLiquidity?: "high" | "medium" | "low";
  /** Regime read from a higher timeframe or a prior snapshot — needed to
   * detect "breakout_expansion", which is inherently a transition
   * (compression -> expansion), not a single-snapshot state. */
  priorRegime?: MarketRegime;
}

export interface RegimeThresholds {
  minMetricsRequired: number;
  strongTrendAdxMin: number;
  weakTrendAdxMin: number;
  compressionAtrPercentileMax: number;
  disorderAtrPercentileMin: number;
  narrowBbWidthPctMax: number;
  wideBbWidthPctMin: number;
  rangeEfficiencyRatioMax: number;
  trendEfficiencyRatioMin: number;
  lowRelativeVolumeMax: number;
  /** If the runner-up regime's score is within this fraction of the winner's
   * score, the read is a conflict and the result is forced to "uncertain". */
  conflictMarginRatio: number;
}

export interface RegimeMetricUsed {
  name: string;
  value: number | string;
}

export interface RegimeClassification {
  regime: MarketRegime;
  /** 0-1. 0 when uncertain due to insufficient data or an unresolved conflict. */
  confidence: number;
  metricsUsed: RegimeMetricUsed[];
  conflicts: string[];
}

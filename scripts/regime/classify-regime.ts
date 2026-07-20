// Deterministic regime classifier (research spec section 7): "La
// classificazione deve essere deterministica [...] Ogni classificazione deve
// mostrare: metriche utilizzate; valori; soglie; risultato; livello di
// confidenza; eventuali conflitti. In caso di conflitto o dati insufficienti
// usare: uncertain."
//
// Each available metric casts a "vote" for one or more regimes with a
// weight. The regime with the highest total weight wins, UNLESS the
// runner-up is within `conflictMarginRatio` of the winner — that's a
// conflict, and the result is forced to "uncertain" rather than picking a
// narrow winner.

import type { MarketRegime, RegimeClassification, RegimeInputMetrics, RegimeThresholds } from "./types.js";

interface Signal {
  regime: MarketRegime;
  weight: number;
}

function collectMetricsUsed(metrics: RegimeInputMetrics): { name: string; value: number | string }[] {
  return Object.entries(metrics)
    .filter(([, v]) => v !== undefined)
    .map(([name, value]) => ({ name, value: value as number | string }));
}

export function classifyRegime(metrics: RegimeInputMetrics, thresholds: RegimeThresholds): RegimeClassification {
  const metricsUsed = collectMetricsUsed(metrics);
  const availableCount = metricsUsed.filter((m) => m.name !== "priorRegime").length;

  if (availableCount < thresholds.minMetricsRequired) {
    return {
      regime: "uncertain",
      confidence: 0,
      metricsUsed,
      conflicts: [
        `only ${availableCount} of ${thresholds.minMetricsRequired} required metrics available`,
      ],
    };
  }

  const signals: Signal[] = [];

  if (metrics.atrPercentile !== undefined) {
    if (metrics.atrPercentile <= thresholds.compressionAtrPercentileMax) {
      signals.push({ regime: "volatility_compression", weight: 1 });
    }
    if (metrics.atrPercentile >= thresholds.disorderAtrPercentileMin) {
      signals.push({ regime: "high_volatility_disorder", weight: 1 });
    }
  }

  if (metrics.bollingerBandWidthPct !== undefined) {
    if (metrics.bollingerBandWidthPct <= thresholds.narrowBbWidthPctMax) {
      signals.push({ regime: "volatility_compression", weight: 1 });
    }
    if (metrics.bollingerBandWidthPct >= thresholds.wideBbWidthPctMin) {
      signals.push({ regime: "high_volatility_disorder", weight: 0.5 });
    }
  }

  if (metrics.adx !== undefined) {
    if (metrics.adx >= thresholds.strongTrendAdxMin) {
      signals.push({ regime: "strong_trend", weight: 1 });
    } else if (metrics.adx >= thresholds.weakTrendAdxMin) {
      signals.push({ regime: "weak_trend", weight: 1 });
    } else {
      signals.push({ regime: "range", weight: 0.5 });
    }
  }

  if (metrics.efficiencyRatio !== undefined) {
    if (metrics.efficiencyRatio >= thresholds.trendEfficiencyRatioMin) {
      const trendRegime: MarketRegime =
        metrics.adx !== undefined && metrics.adx >= thresholds.strongTrendAdxMin ? "strong_trend" : "weak_trend";
      signals.push({ regime: trendRegime, weight: 1 });
    } else if (metrics.efficiencyRatio <= thresholds.rangeEfficiencyRatioMax) {
      signals.push({ regime: "range", weight: 1 });
    }
  }

  if (metrics.relativeVolume !== undefined && metrics.relativeVolume <= thresholds.lowRelativeVolumeMax) {
    signals.push({ regime: "illiquid_noisy", weight: 1 });
  }
  if (metrics.sessionLiquidity === "low") {
    signals.push({ regime: "illiquid_noisy", weight: 0.5 });
  }

  // Breakout expansion is a transition (compression -> expansion), not a
  // single-snapshot state — it needs a reference to a prior/higher-timeframe
  // regime read. Weighted heavily since it's the most specific signal.
  const trendingNow =
    (metrics.adx !== undefined && metrics.adx >= thresholds.strongTrendAdxMin) ||
    (metrics.efficiencyRatio !== undefined && metrics.efficiencyRatio >= thresholds.trendEfficiencyRatioMin);
  if (
    metrics.priorRegime === "volatility_compression" &&
    trendingNow &&
    metrics.atrPercentile !== undefined &&
    metrics.atrPercentile > thresholds.compressionAtrPercentileMax
  ) {
    signals.push({ regime: "breakout_expansion", weight: 2.5 });
  }

  if (signals.length === 0) {
    return {
      regime: "uncertain",
      confidence: 0,
      metricsUsed,
      conflicts: ["no available metric crossed a configured threshold decisively"],
    };
  }

  const scoreByRegime = new Map<MarketRegime, number>();
  for (const s of signals) {
    scoreByRegime.set(s.regime, (scoreByRegime.get(s.regime) ?? 0) + s.weight);
  }
  const ranked = [...scoreByRegime.entries()].sort((a, b) => b[1] - a[1]);
  const [topRegime, topScore] = ranked[0];
  const totalScore = ranked.reduce((sum, [, score]) => sum + score, 0);
  const confidence = totalScore > 0 ? Math.min(1, topScore / totalScore) : 0;

  const runnerUp = ranked[1];
  if (runnerUp && runnerUp[1] >= topScore * (1 - thresholds.conflictMarginRatio)) {
    return {
      regime: "uncertain",
      confidence,
      metricsUsed,
      conflicts: [`${topRegime} (${topScore}) vs ${runnerUp[0]} (${runnerUp[1]}) — too close to call`],
    };
  }

  return { regime: topRegime, confidence, metricsUsed, conflicts: [] };
}

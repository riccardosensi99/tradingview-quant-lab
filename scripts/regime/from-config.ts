import type { ScannerConfig } from "../schemas/config.js";
import type { RegimeThresholds } from "./types.js";

export function regimeThresholdsFromConfig(config: ScannerConfig): RegimeThresholds {
  const r = config.regime;
  return {
    minMetricsRequired: r.min_metrics_required,
    strongTrendAdxMin: r.strong_trend_adx_min,
    weakTrendAdxMin: r.weak_trend_adx_min,
    compressionAtrPercentileMax: r.compression_atr_percentile_max,
    disorderAtrPercentileMin: r.disorder_atr_percentile_min,
    narrowBbWidthPctMax: r.narrow_bb_width_pct_max,
    wideBbWidthPctMin: r.wide_bb_width_pct_min,
    rangeEfficiencyRatioMax: r.range_efficiency_ratio_max,
    trendEfficiencyRatioMin: r.trend_efficiency_ratio_min,
    lowRelativeVolumeMax: r.low_relative_volume_max,
    conflictMarginRatio: r.conflict_margin_ratio,
  };
}

import { describe, expect, it } from "vitest";
import { classifyRegime } from "../scripts/regime/classify-regime.js";
import { regimeThresholdsFromConfig } from "../scripts/regime/from-config.js";
import { ScannerConfigSchema } from "../scripts/schemas/config.js";
import type { RegimeInputMetrics } from "../scripts/regime/types.js";

const thresholds = regimeThresholdsFromConfig(ScannerConfigSchema.parse({ max_bars_per_symbol: 100 }));

function classify(metrics: RegimeInputMetrics) {
  return classifyRegime(metrics, thresholds);
}

describe("classifyRegime", () => {
  it("returns uncertain with zero confidence when too few metrics are available", () => {
    const result = classify({ adx: 30 });
    expect(result.regime).toBe("uncertain");
    expect(result.confidence).toBe(0);
    expect(result.conflicts[0]).toContain("required metrics available");
  });

  it("classifies strong_trend from high ADX + high efficiency ratio + wide-ish structure", () => {
    const result = classify({ adx: 32, efficiencyRatio: 0.65, structureTrend: "HH_HL" });
    expect(result.regime).toBe("strong_trend");
    expect(result.confidence).toBeGreaterThan(0);
  });

  it("classifies weak_trend from moderate ADX", () => {
    const result = classify({ adx: 18, efficiencyRatio: 0.4, structureTrend: "mixed" });
    expect(result.regime).toBe("weak_trend");
  });

  it("classifies range from low ADX + low efficiency ratio", () => {
    const result = classify({ adx: 10, efficiencyRatio: 0.15, atrPercentile: 50 });
    expect(result.regime).toBe("range");
  });

  it("classifies volatility_compression from low ATR percentile + narrow BB width", () => {
    const result = classify({ atrPercentile: 8, bollingerBandWidthPct: 1.2, adx: 12 });
    expect(result.regime).toBe("volatility_compression");
  });

  it("classifies high_volatility_disorder from high ATR percentile + wide BB width", () => {
    const result = classify({ atrPercentile: 92, bollingerBandWidthPct: 8, adx: 12 });
    expect(result.regime).toBe("high_volatility_disorder");
  });

  it("classifies illiquid_noisy from low relative volume + low session liquidity", () => {
    const result = classify({ relativeVolume: 0.2, sessionLiquidity: "low", adx: 12 });
    expect(result.regime).toBe("illiquid_noisy");
  });

  it("classifies breakout_expansion only when priorRegime was compression and volatility/trend just expanded", () => {
    const result = classify({
      priorRegime: "volatility_compression",
      adx: 30,
      efficiencyRatio: 0.6,
      atrPercentile: 45,
    });
    expect(result.regime).toBe("breakout_expansion");
  });

  it("does NOT classify breakout_expansion without a prior compression regime", () => {
    const result = classify({ adx: 30, efficiencyRatio: 0.6, atrPercentile: 45 });
    expect(result.regime).not.toBe("breakout_expansion");
  });

  it("forces uncertain on a genuine conflict between two comparably-weighted regimes", () => {
    // ATR percentile signals compression (weight 1), ADX signals strong trend
    // (weight 1) with no other corroborating metric — a near-tie.
    const result = classify({ atrPercentile: 10, adx: 30 });
    expect(result.regime).toBe("uncertain");
    expect(result.conflicts.length).toBeGreaterThan(0);
  });

  it("every classification reports which metrics were used", () => {
    const result = classify({ adx: 30, efficiencyRatio: 0.6, atrPercentile: 45 });
    const names = result.metricsUsed.map((m) => m.name);
    expect(names).toContain("adx");
    expect(names).toContain("efficiencyRatio");
    expect(names).toContain("atrPercentile");
  });
});

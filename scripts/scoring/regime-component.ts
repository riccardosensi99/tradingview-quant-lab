import type { RegimeClassification } from "../regime/types.js";
import { SCORE_COMPONENT_MAX, ScoreComponent } from "./types.js";

export function scoreRegimeComponent(classification: RegimeClassification): ScoreComponent {
  const max = SCORE_COMPONENT_MAX.regime;

  if (classification.regime === "uncertain") {
    return {
      name: "regime",
      value: 0,
      max,
      rationale: "Regime is uncertain — no reliable directional/volatility read to score against.",
      dataUsed: { regime: classification.regime, confidence: classification.confidence, conflicts: classification.conflicts },
    };
  }

  const value = Math.round(classification.confidence * max);
  return {
    name: "regime",
    value,
    max,
    rationale: `Regime classified as ${classification.regime} with confidence ${classification.confidence.toFixed(2)}.`,
    dataUsed: { regime: classification.regime, confidence: classification.confidence, metricsUsed: classification.metricsUsed },
  };
}

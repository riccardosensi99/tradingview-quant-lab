// Strategy selection (research spec section 9): only status=validated
// strategies compatible with the current market/provider/timeframe/regime/
// direction may be used. This is the enforcement point for "Lo scanner può
// proporre setup operativi esclusivamente utilizzando strategie con stato:
// validated."

import type { StrategyRegistry, StrategyRegistryEntry } from "../schemas/registry.js";
import type { MarketRegime } from "../regime/types.js";
import type { Direction } from "./types.js";

export interface StrategySelectionContext {
  symbol: string;
  provider?: string;
  timeframe: string;
  regime: MarketRegime;
  direction: Direction;
}

export function selectValidatedStrategies(
  registry: StrategyRegistry,
  context: StrategySelectionContext,
): StrategyRegistryEntry[] {
  return registry.strategies.filter((s) => {
    if (s.status !== "validated") return false;
    if (!s.symbol_universe.includes(context.symbol)) return false;

    const timeframeOk = s.timeframes_supported
      ? s.timeframes_supported.includes(context.timeframe)
      : s.timeframe === context.timeframe;
    if (!timeframeOk) return false;

    if (s.regimes_supported && !s.regimes_supported.includes(context.regime)) return false;
    if (s.directions_supported && !s.directions_supported.includes(context.direction)) return false;
    if (context.provider && s.providers_tested && !s.providers_tested.includes(context.provider)) return false;

    return true;
  });
}

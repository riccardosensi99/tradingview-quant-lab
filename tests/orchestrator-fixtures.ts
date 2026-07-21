import { ValidationConfigSchema } from "../scripts/schemas/config.js";
import type { ValidationConfig } from "../scripts/schemas/config.js";
import type { StrategyRegistry } from "../scripts/schemas/registry.js";
import { makeStrategyEntry } from "./scanner-fixtures.js";
import type { LabRunFlags } from "../scripts/orchestrator/types.js";
import { DEFAULT_LAB_FLAGS } from "../scripts/orchestrator/types.js";

export function makeRegistry(entries: Parameters<typeof makeStrategyEntry>[0][] = []): StrategyRegistry {
  return { strategies: entries.map((overrides) => makeStrategyEntry(overrides)) };
}

/** All require_* flags true, all windows/thresholds set (unblocked) —
 * override individual fields per test to reintroduce a specific block. */
export function makeValidationConfig(overrides: Partial<ValidationConfig> = {}): ValidationConfig {
  return ValidationConfigSchema.parse({
    walk_forward: { in_sample_periods: 252, out_of_sample_periods: 63 },
    monte_carlo: { simulations: 1000 },
    minimum_total_trades: 200,
    ...overrides,
  });
}

export function makeLabFlags(overrides: Partial<LabRunFlags> = {}): LabRunFlags {
  return { ...DEFAULT_LAB_FLAGS, ...overrides };
}

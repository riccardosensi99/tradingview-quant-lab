// Read/write helpers for strategies/registry.yaml. All writes re-validate
// through StrategyRegistrySchema before touching disk, so a bad in-memory
// mutation fails loudly instead of corrupting the registry file.

import { writeFileSync } from "node:fs";
import { stringify } from "yaml";
import { loadYaml } from "../lib/load-yaml.js";
import { StrategyRegistry, StrategyRegistryEntry, StrategyRegistrySchema } from "../schemas/registry.js";

const REGISTRY_HEADER = `# Registry of strategies tracked by this lab.
# One entry per strategy, updated as it moves between
# strategies/experimental/, strategies/validated/, and strategies/rejected/.
# Schema and lifecycle: see .claude/skills/tradingview-strategy-research/validation-protocol.md
# Zod schema: scripts/schemas/registry.ts

`;

export function readRegistry(filePath: string): StrategyRegistry {
  return loadYaml(filePath, StrategyRegistrySchema);
}

export function writeRegistry(filePath: string, registry: StrategyRegistry): void {
  const validated = StrategyRegistrySchema.parse(registry);
  const body = stringify(validated, { lineWidth: 0 });
  writeFileSync(filePath, REGISTRY_HEADER + body, "utf8");
}

export function findStrategy(registry: StrategyRegistry, id: string): StrategyRegistryEntry | undefined {
  return registry.strategies.find((s) => s.id === id);
}

/** Returns a new registry with `entry` inserted or replacing the existing
 * entry of the same id — does not mutate the input. */
export function upsertStrategy(registry: StrategyRegistry, entry: StrategyRegistryEntry): StrategyRegistry {
  const idx = registry.strategies.findIndex((s) => s.id === entry.id);
  const strategies = [...registry.strategies];
  if (idx === -1) {
    strategies.push(entry);
  } else {
    strategies[idx] = entry;
  }
  return { strategies };
}

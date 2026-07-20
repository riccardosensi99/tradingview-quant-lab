import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findStrategy, readRegistry, upsertStrategy, writeRegistry } from "../scripts/research/registry-io.js";
import { repoPath } from "./test-paths.js";
import type { StrategyRegistryEntry } from "../scripts/schemas/registry.js";

describe("registry-io", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "registry-io-test-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("round-trips the real registry through a tmp copy without data loss", () => {
    const original = readRegistry(repoPath("strategies/registry.yaml"));
    const tmpFile = join(dir, "registry.yaml");

    writeRegistry(tmpFile, original);
    const reloaded = readRegistry(tmpFile);

    expect(reloaded).toEqual(original);
  });

  it("findStrategy finds sr-volume-zones and returns undefined for an unknown id", () => {
    const registry = readRegistry(repoPath("strategies/registry.yaml"));
    expect(findStrategy(registry, "sr-volume-zones")?.status).toBe("experimental");
    expect(findStrategy(registry, "does-not-exist")).toBeUndefined();
  });

  it("upsertStrategy adds a new entry without mutating the input registry", () => {
    const registry = readRegistry(repoPath("strategies/registry.yaml"));
    const newEntry: StrategyRegistryEntry = {
      id: "test-strategy",
      name: "Test Strategy",
      pine_script_id: "USER;test",
      status: "experimental",
      stage: "idea",
      symbol_universe: ["FX:EURUSD"],
      timeframe: "60",
      created: "2026-07-20",
      last_updated: "2026-07-20",
      metrics: {
        net_profit_pct: 0,
        profit_factor: 0,
        max_drawdown_pct: 0,
        sharpe_ratio: 0,
        sortino_ratio: 0,
        total_trades: 0,
        win_rate_pct: 0,
      },
      reports: { backtests: [], validations: [] },
    };

    const updated = upsertStrategy(registry, newEntry);
    expect(registry.strategies).toHaveLength(1); // original untouched
    expect(updated.strategies).toHaveLength(2);
    expect(findStrategy(updated, "test-strategy")).toBeDefined();
  });

  it("upsertStrategy replaces an existing entry with the same id", () => {
    const registry = readRegistry(repoPath("strategies/registry.yaml"));
    const existing = findStrategy(registry, "sr-volume-zones")!;
    const updated = upsertStrategy(registry, { ...existing, notes: "updated in test" });
    expect(updated.strategies).toHaveLength(1);
    expect(findStrategy(updated, "sr-volume-zones")?.notes).toBe("updated in test");
  });

  it("writeRegistry rejects an invalid registry before touching disk", () => {
    const tmpFile = join(dir, "bad-registry.yaml");
    // @ts-expect-error intentionally invalid for the test
    expect(() => writeRegistry(tmpFile, { strategies: [{ id: "only-id" }] })).toThrow();
  });
});

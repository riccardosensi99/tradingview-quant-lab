import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildExperimentalEntry, commitApprovedIdeas } from "../scripts/generation/registry-entry-from-idea.js";
import { readRegistry, writeRegistry } from "../scripts/research/registry-io.js";
import { StrategyRegistryEntrySchema } from "../scripts/schemas/registry.js";
import { makeHypothesisIdea } from "./hypothesis-fixtures.js";
import type { StrategyRegistry } from "../scripts/schemas/registry.js";

describe("buildExperimentalEntry", () => {
  it("produces an entry that validates against StrategyRegistryEntrySchema", () => {
    const idea = makeHypothesisIdea();
    const entry = buildExperimentalEntry({ idea, reportPath: "reports/ideas/2026-07-20_1200_generation.md", date: "2026-07-20" });
    const result = StrategyRegistryEntrySchema.safeParse(entry);
    expect(result.success).toBe(true);
  });

  it("leaves pine_script_id and metrics absent", () => {
    const idea = makeHypothesisIdea();
    const entry = buildExperimentalEntry({ idea, reportPath: "reports/ideas/x.md", date: "2026-07-20" });
    expect(entry.pine_script_id).toBeUndefined();
    expect(entry.metrics).toBeUndefined();
    expect(entry.status).toBe("experimental");
    expect(entry.stage).toBe("idea");
  });

  it("maps idea fields onto the correct registry entry fields", () => {
    const idea = makeHypothesisIdea();
    const entry = buildExperimentalEntry({ idea, reportPath: "reports/ideas/x.md", date: "2026-07-20" });
    expect(entry.id).toBe(idea.id);
    expect(entry.symbol_universe).toEqual(idea.initial_symbols);
    expect(entry.timeframe).toBe(idea.timeframe_setup);
    expect(entry.timeframes_supported).toEqual(
      expect.arrayContaining([idea.timeframe_context, idea.timeframe_setup, idea.timeframe_trigger]),
    );
    expect(entry.family).toBe(idea.family);
    expect(entry.regimes_supported).toEqual(idea.target_regimes);
    expect(entry.directions_supported).toEqual(idea.directions);
    expect(entry.sessions_supported).toEqual(idea.sessions);
    expect(entry.reports.ideas).toEqual(["reports/ideas/x.md"]);
    expect(entry.notes).toContain("tradingview-strategy-generator");
    expect(entry.notes).toContain(idea.synthesis);
    const params = entry.parameters?.["initial_research_parameters"];
    expect(params).toEqual(idea.initial_research_parameters);
  });
});

describe("commitApprovedIdeas", () => {
  it("adds entries without mutating the input registry", () => {
    const registry: StrategyRegistry = { strategies: [] };
    const idea = makeHypothesisIdea();
    const entry = buildExperimentalEntry({ idea, reportPath: "reports/ideas/x.md", date: "2026-07-20" });
    const updated = commitApprovedIdeas(registry, [entry]);
    expect(registry.strategies).toHaveLength(0);
    expect(updated.strategies).toHaveLength(1);
    expect(updated.strategies[0].id).toBe(idea.id);
  });

  it("commits multiple approved ideas in one call", () => {
    const registry: StrategyRegistry = { strategies: [] };
    const ideaA = makeHypothesisIdea({ id: "idea-a" });
    const ideaB = makeHypothesisIdea({ id: "idea-b" });
    const entries = [
      buildExperimentalEntry({ idea: ideaA, reportPath: "reports/ideas/x.md", date: "2026-07-20" }),
      buildExperimentalEntry({ idea: ideaB, reportPath: "reports/ideas/x.md", date: "2026-07-20" }),
    ];
    const updated = commitApprovedIdeas(registry, entries);
    expect(updated.strategies.map((s) => s.id).sort()).toEqual(["idea-a", "idea-b"]);
  });
});

describe("no write before approval", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "generation-no-write-test-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("buildExperimentalEntry and commitApprovedIdeas never touch disk; only an explicit writeRegistry call does", () => {
    const registry: StrategyRegistry = { strategies: [] };
    const idea = makeHypothesisIdea();
    const entry = buildExperimentalEntry({ idea, reportPath: "reports/ideas/x.md", date: "2026-07-20" });
    const updated = commitApprovedIdeas(registry, [entry]);

    // Propose + commit happened above — the tmpdir must still be empty.
    expect(readdirSync(dir)).toEqual([]);

    // Only this explicit, separate call actually writes to disk.
    const registryPath = join(dir, "registry.yaml");
    writeRegistry(registryPath, updated);
    expect(existsSync(registryPath)).toBe(true);

    const reloaded = readRegistry(registryPath);
    expect(reloaded.strategies[0].id).toBe(idea.id);
  });
});

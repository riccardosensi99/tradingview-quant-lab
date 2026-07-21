import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { planLabRun, formatLabStatus, type LabRunContext } from "../scripts/orchestrator/plan-lab-run.js";
import { DEFAULT_LAB_FLAGS } from "../scripts/orchestrator/types.js";
import { repoPath } from "./test-paths.js";

function baseCtx(overrides: Partial<LabRunContext> = {}): LabRunContext {
  return {
    repoRoot: repoPath("."),
    flags: DEFAULT_LAB_FLAGS,
    asOfIso: "2026-07-20T20:00:00Z",
    gitBranch: "master",
    gitWorkingTreeClean: true,
    gitDirtyFiles: [],
    mcpConfig: null,
    mcpMatchingProcesses: [],
    mcpToolsAvailableInSession: false,
    rawHealthCheck: null,
    chartSymbol: null,
    chartTimeframe: null,
    watchlistSymbolCount: null,
    reportFileNames: { scans: [], backtests: [], validations: [] },
    ...overrides,
  };
}

describe("planLabRun", () => {
  it("loads this repo's real registry/config and produces a deterministic plan", () => {
    const plan = planLabRun(baseCtx());
    expect(plan.systemHealthy).toBe(true);
    expect(plan.systemErrors).toEqual([]);
    // Real registry: sr-volume-zones is needs_more_data, blocked by null
    // walk_forward/monte_carlo config — never resumable — and zero validated
    // strategies, so the only safe/useful default action is generate.
    expect(plan.registryState.counts.needs_more_data).toBe(1);
    expect(plan.registryState.counts.validated).toBe(0);
    expect(plan.needsMoreDataAssessments[0]?.resumable).toBe(false);
    expect(plan.decision.workflow).toBe("strategy-generator");
    expect(plan.decision.approvalRequired).toBe(true);
  });

  it("reports not_configured MCP state when no mcpConfig is supplied", () => {
    const plan = planLabRun(baseCtx());
    expect(plan.mcpStartup.state).toBe("not_configured");
  });

  it("picks the latest dated report from an already-listed filename set", () => {
    const plan = planLabRun(
      baseCtx({ reportFileNames: { scans: ["2026-07-18_scan.md", "2026-07-20_1932_scan.md"], backtests: [], validations: [] } }),
    );
    expect(plan.latestScan?.date).toBe("2026-07-20");
  });

  it("formatLabStatus renders the required status fields", () => {
    const plan = planLabRun(baseCtx());
    const text = formatLabStatus(plan);
    expect(text).toContain("# TradingView Lab Status");
    expect(text).toContain("Recommended workflow: strategy-generator");
    expect(text).toContain("Approval required: yes");
    expect(text).toContain("needs_more_data: 1");
  });
});

describe("planLabRun with an invalid/incomplete repo", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "plan-lab-run-test-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("is BLOCKED when the registry and configs are missing entirely", () => {
    const plan = planLabRun(baseCtx({ repoRoot: dir }));
    expect(plan.systemHealthy).toBe(false);
    expect(plan.systemErrors.length).toBeGreaterThan(0);
    expect(plan.decision.outcome).toBe("BLOCKED");
    expect(plan.decision.workflow).toBeNull();
  });
});

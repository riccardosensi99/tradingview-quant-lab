import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildAuditRecord, appendAuditLog } from "../scripts/orchestrator/audit.js";
import { planLabRun, type LabRunContext } from "../scripts/orchestrator/plan-lab-run.js";
import { DEFAULT_LAB_FLAGS } from "../scripts/orchestrator/types.js";
import { repoPath } from "./test-paths.js";

function realPlan() {
  const ctx: LabRunContext = {
    repoRoot: repoPath("."),
    flags: DEFAULT_LAB_FLAGS,
    asOfIso: "2026-07-20T20:00:00Z",
    gitBranch: "master",
    gitWorkingTreeClean: true,
    gitDirtyFiles: [],
    mcpConfig: { serverName: "tradingview", command: "node", args: ["/home/king/dev/tradingview-mcp/src/server.js"] },
    mcpMatchingProcesses: [],
    mcpToolsAvailableInSession: true,
    rawHealthCheck: { cdp_connected: true, api_available: true, chart_symbol: "FX:USDJPY" },
    chartSymbol: "FX:USDJPY",
    chartTimeframe: "60",
    watchlistSymbolCount: 9,
    reportFileNames: { scans: [], backtests: [], validations: [] },
  };
  return planLabRun(ctx);
}

describe("buildAuditRecord", () => {
  it("captures the fields required by orchestration-rules.md §14, with no secrets", () => {
    const plan = realPlan();
    const record = buildAuditRecord({
      runId: "run-1",
      timestampUtc: "2026-07-20T20:00:00Z",
      plan,
      serverStartedByThisRun: false,
      startupCommandUsed: null,
      pid: null,
      filesModified: [],
      mcpToolsInvoked: ["tv_health_check"],
      approvalsGranted: [],
      durationMs: 120,
      nextStep: "await human approval of the generation report",
    });

    expect(record.runId).toBe("run-1");
    expect(record.mcpState).toBe("ready");
    expect(record.tradingViewHealth).toBe("ready");
    expect(record.workflowChosen).toBe("strategy-generator");
    expect(record.skillDelegated).toBe("tradingview-strategy-generator");
    expect(record.outcome).toBe("ACTION_REQUIRED");

    const serialized = JSON.stringify(record);
    expect(serialized).not.toMatch(/password|token|secret|TRADINGVIEW_SESSION_ID|DATA_PROVIDER_API_KEY/i);
  });

  it("derives skillDelegated from the workflow when not explicitly overridden, and null when no workflow was chosen", () => {
    const plan = realPlan();
    const blocked = { ...plan, decision: { ...plan.decision, workflow: null, outcome: "BLOCKED" as const } };
    const record = buildAuditRecord({
      runId: "run-2",
      timestampUtc: "2026-07-20T20:00:00Z",
      plan: blocked,
      serverStartedByThisRun: false,
      startupCommandUsed: null,
      pid: null,
      filesModified: [],
      mcpToolsInvoked: [],
      approvalsGranted: [],
      durationMs: 5,
      nextStep: "fix blocking issue",
    });
    expect(record.skillDelegated).toBeNull();
  });
});

describe("appendAuditLog", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "lab-audit-test-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("appends one JSON line per call, each independently parseable", () => {
    const file = join(dir, "audit.jsonl");
    const plan = realPlan();
    const record = buildAuditRecord({
      runId: "run-1",
      timestampUtc: "2026-07-20T20:00:00Z",
      plan,
      serverStartedByThisRun: false,
      startupCommandUsed: "node /home/king/dev/tradingview-mcp/src/server.js",
      pid: null,
      filesModified: [],
      mcpToolsInvoked: [],
      approvalsGranted: [],
      durationMs: 10,
      nextStep: "n/a",
    });

    appendAuditLog(file, record);
    appendAuditLog(file, { ...record, runId: "run-2" });

    const lines = readFileSync(file, "utf8").trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).runId).toBe("run-1");
    expect(JSON.parse(lines[1]).runId).toBe("run-2");
  });
});

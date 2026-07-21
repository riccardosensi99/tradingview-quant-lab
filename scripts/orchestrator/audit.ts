// Structured audit log for every /tradingview-lab run — STEERING.md-style
// "show its own working," not a summary. Appends one JSON line per run to
// reports/lab-runs/audit.jsonl (generated, gitignored, same convention as
// reports/{scans,backtests,validations,ideas}/). Never records secrets: the
// startup command/args come straight from .mcp.json (already committed,
// non-secret); env values are never included.

import { appendFileSync } from "node:fs";
import type { LabRunPlan } from "./plan-lab-run.js";

export interface LabAuditRecord {
  runId: string;
  timestampUtc: string;
  goal: string;
  mode: string;
  initialState: {
    experimental: number;
    validation_pending: number;
    needs_more_data: number;
    validation_failed: number;
    rejected: number;
    validated: number;
    disabled: number;
  };
  mcpState: string;
  serverStartedByThisRun: boolean;
  startupCommandUsed: string | null;
  pid: number | null;
  tradingViewHealth: string;
  workflowChosen: string | null;
  skillDelegated: string | null;
  strategyId?: string;
  filesModified: string[];
  mcpToolsInvoked: string[];
  approvalsGranted: string[];
  outcome: string;
  errors: string[];
  durationMs: number;
  nextStep: string;
}

const SKILL_BY_WORKFLOW: Record<string, string> = {
  "strategy-generator": "tradingview-strategy-generator",
  "strategy-research": "tradingview-strategy-research",
  "strategy-validation": "tradingview-strategy-research",
  "market-scanner": "tradingview-market-scanner",
  "registry-review": "tradingview-lab",
  "documentation-sync": "tradingview-lab",
};

export interface BuildAuditRecordInput {
  runId: string;
  timestampUtc: string;
  plan: LabRunPlan;
  serverStartedByThisRun: boolean;
  startupCommandUsed: string | null;
  pid: number | null;
  skillDelegated?: string | null;
  filesModified: string[];
  mcpToolsInvoked: string[];
  approvalsGranted: string[];
  durationMs: number;
  nextStep: string;
}

export function buildAuditRecord(input: BuildAuditRecordInput): LabAuditRecord {
  const { plan } = input;
  const workflow = plan.decision.workflow;
  return {
    runId: input.runId,
    timestampUtc: input.timestampUtc,
    goal: plan.context.flags.goal,
    mode: plan.context.flags.mode,
    initialState: { ...plan.registryState.counts },
    mcpState: plan.mcpStartup.state,
    serverStartedByThisRun: input.serverStartedByThisRun,
    startupCommandUsed: input.startupCommandUsed,
    pid: input.pid,
    tradingViewHealth: plan.mcpStartup.health?.state ?? "not_checked",
    workflowChosen: workflow,
    skillDelegated: workflow ? (input.skillDelegated ?? SKILL_BY_WORKFLOW[workflow] ?? null) : null,
    strategyId: plan.decision.strategyId,
    filesModified: input.filesModified,
    mcpToolsInvoked: input.mcpToolsInvoked,
    approvalsGranted: input.approvalsGranted,
    outcome: plan.decision.outcome,
    errors: plan.systemErrors,
    durationMs: input.durationMs,
    nextStep: input.nextStep,
  };
}

export function appendAuditLog(filePath: string, record: LabAuditRecord): void {
  appendFileSync(filePath, JSON.stringify(record) + "\n", "utf8");
}

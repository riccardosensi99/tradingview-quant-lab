// The orchestrator's deterministic decision engine (single source of the
// state machine described in .claude/skills/tradingview-lab/state-machine.md).
// Pure function: no MCP calls, no disk access — every fact it needs is
// already computed by inspect-state.ts / scripts/mcp/startup-manager.ts and
// handed in. Always resolves to at most one workflow, which is how
// `max-actions: 1` (STEERING-equivalent default for this skill) is enforced
// by construction rather than by a separate counter.

import type { LabRunFlags, LabGoal, LabWorkflow } from "./types.js";
import type { RegistryStateSummary, NeedsMoreDataAssessment } from "./inspect-state.js";
import type { McpStartupState } from "../mcp/startup-manager.js";

export type WorkflowOutcome = "READY" | "ACTION_REQUIRED" | "BLOCKED" | "NO_ACTION";

export interface WorkflowDecision {
  outcome: WorkflowOutcome;
  workflow: LabWorkflow | null;
  strategyId?: string;
  reason: string;
  approvalRequired: boolean;
}

export interface ChooseWorkflowInput {
  flags: LabRunFlags;
  systemHealthy: boolean;
  systemErrors: string[];
  mcpState: McpStartupState;
  watchlistAvailable: boolean;
  registryState: RegistryStateSummary;
  needsMoreDataAssessments: NeedsMoreDataAssessment[];
}

/** Documents the default priority order (STEP 3 below) — informational,
 * the function does not iterate this array, it encodes the same order
 * procedurally so each branch can attach its own reason/strategyId. */
export const DEFAULT_WORKFLOW_PRIORITY: readonly LabWorkflow[] = [
  "strategy-validation",
  "strategy-research",
  "strategy-generator",
  "market-scanner",
  "documentation-sync",
  "registry-review",
];

const WORKFLOWS_REQUIRING_MCP: ReadonlySet<LabWorkflow> = new Set([
  "strategy-research",
  "strategy-validation",
  "market-scanner",
]);

const WORKFLOWS_ALWAYS_REQUIRING_APPROVAL: ReadonlySet<LabWorkflow> = new Set([
  "strategy-generator",
  "strategy-research",
  "strategy-validation",
]);

function approvalRequiredFor(workflow: LabWorkflow, flags: LabRunFlags): boolean {
  if (WORKFLOWS_ALWAYS_REQUIRING_APPROVAL.has(workflow)) return true;
  return flags.requireApproval;
}

function mcpReady(state: McpStartupState): boolean {
  return state === "ready" || state === "already_running";
}

function readyOrBlocked(
  workflow: LabWorkflow,
  outcomeIfReady: Exclude<WorkflowOutcome, "BLOCKED" | "NO_ACTION">,
  reasonIfReady: string,
  strategyId: string | undefined,
  input: ChooseWorkflowInput,
): WorkflowDecision {
  if (WORKFLOWS_REQUIRING_MCP.has(workflow) && !mcpReady(input.mcpState)) {
    return {
      outcome: "BLOCKED",
      workflow: null,
      reason: `Workflow "${workflow}" requires MCP but it is not ready (state: ${input.mcpState}).`,
      approvalRequired: false,
    };
  }
  return {
    outcome: outcomeIfReady,
    workflow,
    strategyId,
    reason: reasonIfReady,
    approvalRequired: approvalRequiredFor(workflow, input.flags),
  };
}

const GOAL_TO_WORKFLOW: Record<Exclude<LabGoal, "auto">, LabWorkflow> = {
  generate: "strategy-generator",
  research: "strategy-research",
  validate: "strategy-validation",
  scan: "market-scanner",
  review: "registry-review",
  status: "registry-review",
  docs: "documentation-sync",
};

export function chooseWorkflow(input: ChooseWorkflowInput): WorkflowDecision {
  if (input.flags.maxActions < 1) {
    return { outcome: "NO_ACTION", workflow: null, reason: "max-actions is 0 — nothing to do.", approvalRequired: false };
  }

  // STEP 1 — system health
  if (!input.systemHealthy) {
    return {
      outcome: "BLOCKED",
      workflow: null,
      reason: `System health check failed: ${input.systemErrors.join("; ") || "unknown error"}`,
      approvalRequired: false,
    };
  }

  // STEP 2 — explicitly requested workflow/goal
  if (input.flags.workflow !== "auto") {
    return readyOrBlocked(
      input.flags.workflow,
      "READY",
      `Workflow explicitly requested via --workflow=${input.flags.workflow}.`,
      input.flags.strategyId,
      input,
    );
  }

  if (input.flags.goal === "scan") {
    if (input.registryState.counts.validated === 0) {
      return {
        outcome: "NO_ACTION",
        workflow: null,
        reason: "Explicit scan requested but no validated strategies exist yet — the scanner would only produce NO TRADE by construction.",
        approvalRequired: false,
      };
    }
    return readyOrBlocked(
      "market-scanner",
      "READY",
      "Explicit scan requested and validated strategies exist — bypassing research priority (per orchestration-rules.md's exception).",
      undefined,
      input,
    );
  }

  if (input.flags.goal !== "auto") {
    const workflow = GOAL_TO_WORKFLOW[input.flags.goal];
    return readyOrBlocked(workflow, "READY", `Goal explicitly requested via --goal=${input.flags.goal}.`, input.flags.strategyId, input);
  }

  // STEP 3 — priority order (goal=auto, workflow=auto)
  if (input.registryState.validationPendingIds.length > 0) {
    const id = input.registryState.validationPendingIds[0];
    return readyOrBlocked(
      "strategy-validation",
      "ACTION_REQUIRED",
      `Strategy "${id}" is status=validation_pending — highest priority (research already started).`,
      id,
      input,
    );
  }

  const resumable = input.needsMoreDataAssessments.find((a) => a.resumable);
  if (resumable) {
    return readyOrBlocked(
      "strategy-research",
      "ACTION_REQUIRED",
      `Strategy "${resumable.id}" is needs_more_data and can now resume: ${resumable.resumableGaps.join(", ")}.`,
      resumable.id,
      input,
    );
  }

  if (input.registryState.experimentalApprovedNotBacktested.length > 0) {
    const id = input.registryState.experimentalApprovedNotBacktested[0];
    return readyOrBlocked(
      "strategy-research",
      "ACTION_REQUIRED",
      `Strategy "${id}" is experimental with Pine code approved but never backtested.`,
      id,
      input,
    );
  }

  if (input.registryState.counts.validated === 0) {
    return readyOrBlocked(
      "strategy-generator",
      "ACTION_REQUIRED",
      "No validated strategies and no in-progress research/validation candidates — proposing new strategy ideas to fill the registry.",
      undefined,
      input,
    );
  }

  // STEP 4 — scanner (only once validated strategies exist)
  if (!input.watchlistAvailable) {
    return {
      outcome: "BLOCKED",
      workflow: null,
      reason: "Validated strategies exist but the watchlist is unavailable.",
      approvalRequired: false,
    };
  }
  return readyOrBlocked(
    "market-scanner",
    "READY",
    "Validated strategies exist and MCP/watchlist are available.",
    undefined,
    input,
  );
}

// Composes read-mcp-config / process-status / health-check into the 8
// startup states used by the tradingview-lab orchestrator. See
// .claude/skills/tradingview-lab/mcp-startup.md for the full rationale.
//
// The authoritative readiness signal is `toolsAvailableInSession` — whether
// the mcp__tradingview__* tool schemas actually respond in this Claude Code
// session right now — never `matchingProcesses` (ps-based detection cannot
// tell this session's own stdio-spawned server apart from an orphan left by
// a previous restart; verified live: 3 such orphans existed on this machine
// while writing this module). matchingProcesses is carried through purely
// for the status report, never used in the decision below.

import type { TradingviewMcpConfig } from "./read-mcp-config.js";
import type { ProcessMatch } from "./process-status.js";
import type { McpHealthResult } from "./health-check.js";

export type McpStartupState =
  | "not_configured"
  | "configured"
  | "already_running"
  | "started"
  | "start_failed"
  | "unhealthy"
  | "tradingview_unreachable"
  | "ready";

export type StartAttempt =
  | { ok: true; pid: number; command: string; startedAtUtc: string }
  | { ok: false; error: string };

export interface McpStartupInput {
  config: TradingviewMcpConfig | null;
  matchingProcesses: ProcessMatch[];
  /** Whether mcp__tradingview__* tools are callable in this session. */
  toolsAvailableInSession: boolean;
  /** Result of a live tv_health_check call already made by the agent, or
   * null if none was made yet (e.g. tools aren't available). */
  health: McpHealthResult | null;
  /** Set only when a manual start was explicitly confirmed and attempted
   * this run — see scripts/mcp/start-server.ts. Never set for the normal
   * stdio-managed case. */
  startAttempt?: StartAttempt;
}

export interface McpStartupReport {
  state: McpStartupState;
  config: TradingviewMcpConfig | null;
  matchingProcesses: ProcessMatch[];
  health: McpHealthResult | null;
  toolsAvailableInSession: boolean;
  startAttempted: boolean;
  startResult?: { pid: number; command: string; startedAtUtc: string };
  startError?: string;
  reason: string;
}

export function evaluateMcpStartup(input: McpStartupInput): McpStartupReport {
  const base = {
    config: input.config,
    matchingProcesses: input.matchingProcesses,
  };

  if (!input.config) {
    return {
      ...base,
      state: "not_configured",
      health: null,
      toolsAvailableInSession: false,
      startAttempted: false,
      reason: '.mcp.json has no "tradingview" server entry — nothing to start or check.',
    };
  }

  if (!input.toolsAvailableInSession) {
    if (input.startAttempt) {
      if (input.startAttempt.ok) {
        return {
          ...base,
          state: "started",
          health: null,
          toolsAvailableInSession: false,
          startAttempted: true,
          startResult: {
            pid: input.startAttempt.pid,
            command: input.startAttempt.command,
            startedAtUtc: input.startAttempt.startedAtUtc,
          },
          reason: "Manual start was explicitly confirmed and the process spawned successfully; readiness still requires a follow-up health check.",
        };
      }
      return {
        ...base,
        state: "start_failed",
        health: null,
        toolsAvailableInSession: false,
        startAttempted: true,
        startError: input.startAttempt.error,
        reason: `Manual start failed: ${input.startAttempt.error}`,
      };
    }
    return {
      ...base,
      state: "configured",
      health: null,
      toolsAvailableInSession: false,
      startAttempted: false,
      reason:
        input.matchingProcesses.length > 0
          ? `${input.matchingProcesses.length} matching OS process(es) found, but the tradingview MCP tools are not available in this session — a Claude Code session restart is required to load .mcp.json (do not spawn another process).`
          : "tradingview MCP tools are not available in this session — a Claude Code session restart is required to load .mcp.json.",
    };
  }

  // Tools already respond in this session: a server instance is already
  // wired up. Never attempt to start a new one from here on, regardless of
  // matchingProcesses.
  if (!input.health) {
    return {
      ...base,
      state: "already_running",
      health: null,
      toolsAvailableInSession: true,
      startAttempted: false,
      reason: "MCP tools are already available in this session (server already running, managed by Claude Code's stdio transport) — run a live tv_health_check to confirm readiness.",
    };
  }

  if (input.health.state === "ready") {
    return {
      ...base,
      state: "ready",
      health: input.health,
      toolsAvailableInSession: true,
      startAttempted: false,
      reason: input.health.reason,
    };
  }

  return {
    ...base,
    state: input.health.state,
    health: input.health,
    toolsAvailableInSession: true,
    startAttempted: false,
    reason: input.health.reason,
  };
}

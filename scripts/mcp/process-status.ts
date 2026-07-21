// Local OS process detection for the configured MCP server command.
//
// This is informational only — see mcp-startup.md. `ps` cannot tell this
// Claude Code session's own stdio-spawned server process apart from an
// orphan left by a previous session restart, so a match here must never be
// used to decide whether to start or kill anything. The one reliable
// readiness signal is whether the mcp__tradingview__* tools actually respond
// in this session (scripts/mcp/health-check.ts + startup-manager.ts).

import { execFileSync } from "node:child_process";

export interface RunningProcessInfo {
  pid: number;
  command: string;
}

export type ProcessLister = () => RunningProcessInfo[];

/** Default process lister: `ps -eo pid,args`, no shell interpolation
 * (execFileSync with an argv array, not a shell string). Returns [] on any
 * failure (e.g. `ps` unavailable on this platform) rather than throwing —
 * process detection is advisory, never load-bearing. */
export function listProcessesViaPs(): RunningProcessInfo[] {
  let output: string;
  try {
    output = execFileSync("ps", ["-eo", "pid,args"], { encoding: "utf8" });
  } catch {
    return [];
  }

  const processes: RunningProcessInfo[] = [];
  for (const line of output.split("\n").slice(1)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = /^(\d+)\s+(.*)$/.exec(trimmed);
    if (!match) continue;
    processes.push({ pid: Number(match[1]), command: match[2] });
  }
  return processes;
}

export interface ProcessMatch {
  pid: number;
  command: string;
}

/** Finds already-running processes whose command line contains every token
 * of the configured command — a loose, informational match only (never used
 * to decide to start or kill a process). */
export function findMatchingProcesses(
  config: { command: string; args: string[] },
  processes: RunningProcessInfo[],
): ProcessMatch[] {
  const needles = [config.command, ...config.args];
  return processes
    .filter((p) => needles.every((needle) => p.command.includes(needle)))
    .map((p) => ({ pid: p.pid, command: p.command }));
}

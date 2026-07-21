// Spawns the MCP server as a detached, logged child process.
//
// This exists only for the documented fallback case in mcp-startup.md — a
// stdio-configured server (this repo's .mcp.json) is already spawned
// automatically by Claude Code when the session loads it. Calling this while
// that's true creates an unmanaged duplicate instance (verified live: three
// orphaned `node .../tradingview-mcp/src/server.js` processes already exist
// on this machine from prior session restarts — see mcp-startup.md). Callers
// must go through scripts/mcp/startup-manager.ts, which only ever reaches a
// state where calling this is appropriate when tools are NOT already
// available in the session, and must have the user's explicit confirmation
// for this specific action (STEERING.md safety boundaries / approval-gates.md).

import { openSync, closeSync } from "node:fs";
import { spawn as nodeSpawn, type ChildProcess } from "node:child_process";

export class StartServerError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "StartServerError";
  }
}

export interface StartServerRequest {
  command: string;
  args: string[];
  cwd?: string;
  logFilePath: string;
  /** Must be explicitly true. There is no default — the caller (the
   * orchestrator, only after the user confirmed this exact action) must
   * construct this value deliberately. */
  confirmed: true;
}

export interface StartServerResult {
  pid: number;
  command: string;
  args: string[];
  cwd?: string;
  logFilePath: string;
  startedAtUtc: string;
}

export interface StartServerDeps {
  spawn: (command: string, args: string[], options: { cwd?: string; detached: boolean; stdio: ["ignore", number, number] }) => ChildProcess;
  openLogFd: (path: string) => number;
  closeLogFd: (fd: number) => void;
}

const defaultDeps: StartServerDeps = {
  spawn: (command, args, options) => nodeSpawn(command, args, options),
  openLogFd: (path) => openSync(path, "a"),
  closeLogFd: (fd) => closeSync(fd),
};

export function startServer(request: StartServerRequest, deps: StartServerDeps = defaultDeps): StartServerResult {
  if (!request.confirmed) {
    throw new StartServerError("startServer requires explicit user confirmation (confirmed: true)");
  }

  const logFd = deps.openLogFd(request.logFilePath);
  let child: ChildProcess;
  try {
    child = deps.spawn(request.command, request.args, {
      cwd: request.cwd,
      detached: true,
      stdio: ["ignore", logFd, logFd],
    });
  } catch (err) {
    deps.closeLogFd(logFd);
    throw new StartServerError(`Failed to spawn "${request.command}"`, err);
  }

  child.unref();
  deps.closeLogFd(logFd);

  if (child.pid === undefined) {
    throw new StartServerError(`Spawn of "${request.command}" produced no PID`);
  }

  return {
    pid: child.pid,
    command: request.command,
    args: request.args,
    cwd: request.cwd,
    logFilePath: request.logFilePath,
    startedAtUtc: new Date().toISOString(),
  };
}

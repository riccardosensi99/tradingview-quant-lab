import { describe, expect, it, vi } from "vitest";
import { startServer, StartServerError, type StartServerDeps } from "../scripts/mcp/start-server.js";

function fakeDeps(overrides: Partial<StartServerDeps> = {}): StartServerDeps {
  return {
    spawn: vi.fn(() => ({ pid: 4242, unref: vi.fn() }) as any),
    openLogFd: vi.fn(() => 7),
    closeLogFd: vi.fn(),
    ...overrides,
  };
}

describe("startServer", () => {
  it("refuses to spawn without explicit confirmation (type system already enforces this, guard is defense in depth)", () => {
    const deps = fakeDeps();
    expect(() =>
      startServer({ command: "node", args: ["server.js"], logFilePath: "/tmp/x.log", confirmed: false as unknown as true }, deps),
    ).toThrow(StartServerError);
    expect(deps.spawn).not.toHaveBeenCalled();
  });

  it("spawns via the injected deps and returns pid/command/timestamp on success", () => {
    const deps = fakeDeps();
    const result = startServer({ command: "node", args: ["server.js"], cwd: "/repo", logFilePath: "/tmp/x.log", confirmed: true }, deps);
    expect(result.pid).toBe(4242);
    expect(result.command).toBe("node");
    expect(result.args).toEqual(["server.js"]);
    expect(result.cwd).toBe("/repo");
    expect(deps.spawn).toHaveBeenCalledTimes(1);
    expect(deps.closeLogFd).toHaveBeenCalledWith(7);
  });

  it("wraps a spawn failure in StartServerError and still closes the log fd", () => {
    const deps = fakeDeps({
      spawn: vi.fn(() => {
        throw new Error("ENOENT");
      }),
    });
    expect(() => startServer({ command: "node", args: [], logFilePath: "/tmp/x.log", confirmed: true }, deps)).toThrow(StartServerError);
    expect(deps.closeLogFd).toHaveBeenCalled();
  });

  it("throws StartServerError when spawn produces no pid", () => {
    const deps = fakeDeps({ spawn: vi.fn(() => ({ pid: undefined, unref: vi.fn() }) as any) });
    expect(() => startServer({ command: "node", args: [], logFilePath: "/tmp/x.log", confirmed: true }, deps)).toThrow(StartServerError);
  });
});

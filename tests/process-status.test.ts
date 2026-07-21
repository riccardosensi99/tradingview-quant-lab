import { describe, expect, it } from "vitest";
import { findMatchingProcesses, type RunningProcessInfo } from "../scripts/mcp/process-status.js";

describe("findMatchingProcesses", () => {
  const config = { command: "node", args: ["/home/king/dev/tradingview-mcp/src/server.js"] };

  it("matches processes whose command line contains every configured token", () => {
    const processes: RunningProcessInfo[] = [
      { pid: 7350, command: "node /home/king/dev/tradingview-mcp/src/server.js" },
      { pid: 181428, command: "node /home/king/dev/tradingview-mcp/src/server.js" },
      { pid: 999, command: "node /some/other/app.js" },
    ];
    const matches = findMatchingProcesses(config, processes);
    expect(matches).toHaveLength(2);
    expect(matches.map((m) => m.pid)).toEqual([7350, 181428]);
  });

  it("returns an empty array when nothing matches", () => {
    const processes: RunningProcessInfo[] = [{ pid: 1, command: "bash -c ls" }];
    expect(findMatchingProcesses(config, processes)).toEqual([]);
  });

  it("does not mutate the input process list", () => {
    const processes: RunningProcessInfo[] = [{ pid: 7350, command: "node /home/king/dev/tradingview-mcp/src/server.js" }];
    const snapshot = [...processes];
    findMatchingProcesses(config, processes);
    expect(processes).toEqual(snapshot);
  });
});

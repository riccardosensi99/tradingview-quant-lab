import { describe, expect, it } from "vitest";
import { evaluateMcpStartup } from "../scripts/mcp/startup-manager.js";
import { interpretHealthCheck } from "../scripts/mcp/health-check.js";
import type { TradingviewMcpConfig } from "../scripts/mcp/read-mcp-config.js";

const config: TradingviewMcpConfig = {
  serverName: "tradingview",
  command: "node",
  args: ["/home/king/dev/tradingview-mcp/src/server.js"],
};

describe("evaluateMcpStartup", () => {
  it("not_configured when .mcp.json has no tradingview entry", () => {
    const report = evaluateMcpStartup({ config: null, matchingProcesses: [], toolsAvailableInSession: false, health: null });
    expect(report.state).toBe("not_configured");
  });

  it("configured when config exists but tools are not available in this session yet (needs a restart)", () => {
    const report = evaluateMcpStartup({ config, matchingProcesses: [], toolsAvailableInSession: false, health: null });
    expect(report.state).toBe("configured");
    expect(report.reason).toMatch(/session restart/);
  });

  it("configured (with orphan note) when OS processes match but tools are still unavailable — never treated as running", () => {
    const report = evaluateMcpStartup({
      config,
      matchingProcesses: [{ pid: 7350, command: "node .../server.js" }, { pid: 181428, command: "node .../server.js" }],
      toolsAvailableInSession: false,
      health: null,
    });
    expect(report.state).toBe("configured");
    expect(report.reason).toContain("2 matching OS process");
    expect(report.startAttempted).toBe(false);
  });

  it("already_running when tools respond in-session but no health check has been made yet", () => {
    const report = evaluateMcpStartup({ config, matchingProcesses: [], toolsAvailableInSession: true, health: null });
    expect(report.state).toBe("already_running");
  });

  it("ready when tools respond and a live health check confirms it", () => {
    const health = interpretHealthCheck({ cdp_connected: true, api_available: true, chart_symbol: "FX:USDJPY" });
    const report = evaluateMcpStartup({ config, matchingProcesses: [], toolsAvailableInSession: true, health });
    expect(report.state).toBe("ready");
  });

  it("tradingview_unreachable when the health check says cdp_connected is false", () => {
    const health = interpretHealthCheck({ cdp_connected: false });
    const report = evaluateMcpStartup({ config, matchingProcesses: [], toolsAvailableInSession: true, health });
    expect(report.state).toBe("tradingview_unreachable");
  });

  it("unhealthy when the health check is inconclusive", () => {
    const health = interpretHealthCheck({});
    const report = evaluateMcpStartup({ config, matchingProcesses: [], toolsAvailableInSession: true, health });
    expect(report.state).toBe("unhealthy");
  });

  it("started when a confirmed manual start attempt succeeds", () => {
    const report = evaluateMcpStartup({
      config,
      matchingProcesses: [],
      toolsAvailableInSession: false,
      health: null,
      startAttempt: { ok: true, pid: 4242, command: "node server.js", startedAtUtc: "2026-07-20T20:00:00Z" },
    });
    expect(report.state).toBe("started");
    expect(report.startResult?.pid).toBe(4242);
  });

  it("start_failed when a confirmed manual start attempt fails", () => {
    const report = evaluateMcpStartup({
      config,
      matchingProcesses: [],
      toolsAvailableInSession: false,
      health: null,
      startAttempt: { ok: false, error: "ENOENT" },
    });
    expect(report.state).toBe("start_failed");
    expect(report.startError).toBe("ENOENT");
  });

  it("never reports already_running/ready purely from matchingProcesses — toolsAvailableInSession is authoritative", () => {
    // 3 orphaned processes found (this repo's real live state at design time) but the
    // session's own tools are not wired up — must still say "configured", not "already_running".
    const report = evaluateMcpStartup({
      config,
      matchingProcesses: [
        { pid: 7350, command: "node .../server.js" },
        { pid: 181428, command: "node .../server.js" },
        { pid: 276910, command: "node .../server.js" },
      ],
      toolsAvailableInSession: false,
      health: null,
    });
    expect(report.state).not.toBe("already_running");
    expect(report.state).not.toBe("ready");
  });
});

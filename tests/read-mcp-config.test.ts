import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { McpConfigError, readMcpConfig } from "../scripts/mcp/read-mcp-config.js";
import { repoPath } from "./test-paths.js";

describe("readMcpConfig", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "mcp-config-test-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("reads this repo's real .mcp.json and extracts the tradingview server command", () => {
    const config = readMcpConfig(repoPath(".mcp.json"));
    expect(config).not.toBeNull();
    expect(config?.command).toBe("node");
    expect(config?.args).toContain("/home/king/dev/tradingview-mcp/src/server.js");
  });

  it("returns null when the file does not exist (not_configured, not an error)", () => {
    expect(readMcpConfig(join(dir, "missing.json"))).toBeNull();
  });

  it("returns null when mcpServers has no tradingview entry", () => {
    const file = join(dir, ".mcp.json");
    writeFileSync(file, JSON.stringify({ mcpServers: { other: { command: "node", args: ["x.js"] } } }));
    expect(readMcpConfig(file)).toBeNull();
  });

  it("throws McpConfigError on malformed JSON", () => {
    const file = join(dir, ".mcp.json");
    writeFileSync(file, "{ not json");
    expect(() => readMcpConfig(file)).toThrow(McpConfigError);
  });

  it("throws McpConfigError when the tradingview entry fails schema validation", () => {
    const file = join(dir, ".mcp.json");
    writeFileSync(file, JSON.stringify({ mcpServers: { tradingview: { args: ["x.js"] } } }));
    expect(() => readMcpConfig(file)).toThrow(McpConfigError);
  });
});

// Reads and validates .mcp.json's "tradingview" server entry. No silent
// fallback: malformed JSON or a schema violation throws; a missing file or a
// missing "tradingview" entry returns null (a legitimate not_configured
// state, not an error) — see scripts/mcp/startup-manager.ts.

import { readFileSync } from "node:fs";
import { z } from "zod";

export class McpConfigError extends Error {
  constructor(filePath: string, message: string) {
    super(`Invalid MCP config at ${filePath}: ${message}`);
    this.name = "McpConfigError";
  }
}

const McpServerEntrySchema = z.object({
  type: z.string().optional(),
  command: z.string(),
  args: z.array(z.string()).default([]),
  cwd: z.string().optional(),
  env: z.record(z.string(), z.string()).default({}),
});

const McpConfigFileSchema = z.object({
  mcpServers: z.record(z.string(), McpServerEntrySchema),
});

const TRADINGVIEW_SERVER_NAME = "tradingview";

export interface TradingviewMcpConfig {
  serverName: string;
  command: string;
  args: string[];
  cwd?: string;
}

/** Returns null when the file is absent or has no "tradingview" server
 * entry (not_configured) — throws only on a file that exists but is
 * malformed JSON or fails the schema. */
export function readMcpConfig(filePath: string): TradingviewMcpConfig | null {
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new McpConfigError(filePath, `not valid JSON (${(err as Error).message})`);
  }

  const result = McpConfigFileSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new McpConfigError(filePath, issues);
  }

  const entry = result.data.mcpServers[TRADINGVIEW_SERVER_NAME];
  if (!entry) return null;

  return {
    serverName: TRADINGVIEW_SERVER_NAME,
    command: entry.command,
    args: entry.args,
    cwd: entry.cwd,
  };
}

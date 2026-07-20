// Records every MCP tool the adapter invokes during a session, so a skill
// run can show its audit log ("tool MCP utilizzati") in the final report.

export interface AuditEntry {
  tool: string;
  args?: unknown;
  timestamp: string;
  ok: boolean;
  error?: string;
}

export class ToolAuditLog {
  private readonly entries: AuditEntry[] = [];

  record(tool: string, args: unknown, ok: boolean, error?: string): void {
    this.entries.push({ tool, args, timestamp: new Date().toISOString(), ok, error });
  }

  list(): readonly AuditEntry[] {
    return this.entries;
  }

  toolsUsed(): string[] {
    return [...new Set(this.entries.map((e) => e.tool))];
  }

  failures(): AuditEntry[] {
    return this.entries.filter((e) => !e.ok);
  }
}

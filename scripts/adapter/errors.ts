export class McpToolError extends Error {
  constructor(
    public readonly tool: string,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(`[${tool}] ${message}`);
    this.name = "McpToolError";
  }
}

/** Thrown when code asks the adapter for something MCP_CAPABILITIES.md
 * documents as unavailable (e.g. a per-bar equity curve), instead of
 * silently returning empty/default data. */
export class MissingCapabilityError extends Error {
  constructor(capability: string, detail: string) {
    super(`Capability not available: ${capability} — ${detail}`);
    this.name = "MissingCapabilityError";
  }
}

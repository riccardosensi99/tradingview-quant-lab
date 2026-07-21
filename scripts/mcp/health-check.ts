// Interprets an already-obtained tv_health_check payload into a typed
// health state. Never calls the tool itself — scripts/ never calls
// mcp__tradingview__* (STEERING.md §3, ADR 0001). The calling agent performs
// the live health check and hands the raw result to interpretHealthCheck().
//
// Field names follow MCP_CAPABILITIES.md's verified tv_health_check
// response (cdp_connected, api_available, chart_symbol, ...); only those are
// asserted, the rest pass through via .catchall() rather than inventing a
// full shape (same pattern as scripts/adapter/types.ts).

import { z } from "zod";

export const RawHealthCheckSchema = z
  .object({
    success: z.boolean().optional(),
    cdp_connected: z.boolean().optional(),
    api_available: z.boolean().optional(),
    chart_symbol: z.string().optional(),
    chart_resolution: z.union([z.string(), z.number()]).optional(),
  })
  .catchall(z.unknown());
export type RawHealthCheck = z.infer<typeof RawHealthCheckSchema>;

export type McpHealthState = "unhealthy" | "tradingview_unreachable" | "ready";

export interface McpHealthResult {
  state: McpHealthState;
  cdpConnected: boolean | null;
  apiAvailable: boolean | null;
  chartSymbol: string | null;
  reason: string;
}

export function interpretHealthCheck(raw: unknown): McpHealthResult {
  const parsed = RawHealthCheckSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      state: "unhealthy",
      cdpConnected: null,
      apiAvailable: null,
      chartSymbol: null,
      reason: "tv_health_check response did not match the expected shape",
    };
  }

  const data = parsed.data;
  const cdpConnected = data.cdp_connected ?? null;
  const apiAvailable = data.api_available ?? null;
  const chartSymbol = data.chart_symbol ?? null;

  if (cdpConnected === false) {
    return {
      state: "tradingview_unreachable",
      cdpConnected,
      apiAvailable,
      chartSymbol,
      reason: "cdp_connected is false — TradingView Desktop is not running with --remote-debugging-port=9222, or the port is unreachable",
    };
  }

  if (cdpConnected === null || apiAvailable !== true) {
    return {
      state: "unhealthy",
      cdpConnected,
      apiAvailable,
      chartSymbol,
      reason: "tv_health_check did not confirm both cdp_connected and api_available",
    };
  }

  return {
    state: "ready",
    cdpConnected,
    apiAvailable,
    chartSymbol,
    reason: "cdp_connected and api_available both true",
  };
}

// Market Data Adapter — the single boundary between raw `tradingview` MCP
// tool calls and the rest of this codebase (research/validation/scanner
// logic must never call MCP tools directly; they call this adapter).
//
// A plain Node.js script has no access to Claude Code's MCP tool-calling
// mechanism — only the agent executing a skill can actually invoke
// `mcp__tradingview__*` tools. This adapter therefore takes the raw call as
// an injected `RawToolCaller`: in a live skill run, that function is the
// thin bridge the calling agent supplies (each call maps 1:1 to a real MCP
// tool invocation it performs); in tests, it's a fixture-backed fake. Either
// way, every call is validated, capability-guarded, and audit-logged here in
// one place.

import { ToolAuditLog } from "./audit.js";
import { MAX_OHLCV_BARS_PER_CALL, PER_BAR_EQUITY_CURVE_AVAILABLE } from "./capabilities.js";
import { McpToolError, MissingCapabilityError } from "./errors.js";
import {
  RawStrategyResults,
  RawStrategyResultsSchema,
  RawTradeFill,
  RawTradesResponseSchema,
  UnverifiedPayload,
  UnverifiedPayloadSchema,
} from "./types.js";

export type RawToolCaller = (tool: string, args?: Record<string, unknown>) => Promise<unknown>;

export interface OhlcvParams {
  symbol: string;
  timeframe: string;
  bars?: number;
}

export interface StrategyResultsParams {
  symbol?: string;
  timeframe?: string;
}

export interface TradesParams {
  symbol?: string;
  maxTrades?: number;
}

export class MarketDataAdapter {
  public readonly auditLog = new ToolAuditLog();

  constructor(private readonly call: RawToolCaller) {}

  private async invoke<T>(tool: string, args: Record<string, unknown> | undefined, parse: (raw: unknown) => T): Promise<T> {
    let raw: unknown;
    try {
      raw = await this.call(tool, args);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.auditLog.record(tool, args, false, message);
      throw new McpToolError(tool, message, err);
    }
    try {
      const parsed = parse(raw);
      this.auditLog.record(tool, args, true);
      return parsed;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.auditLog.record(tool, args, false, `response validation failed: ${message}`);
      throw new McpToolError(tool, `response validation failed: ${message}`, err);
    }
  }

  getWatchlist(): Promise<UnverifiedPayload> {
    return this.invoke("watchlist_get", undefined, (raw) => UnverifiedPayloadSchema.parse(raw));
  }

  getSymbolInfo(symbol: string): Promise<UnverifiedPayload> {
    return this.invoke("symbol_info", { symbol }, (raw) => UnverifiedPayloadSchema.parse(raw));
  }

  getChartState(): Promise<UnverifiedPayload> {
    return this.invoke("chart_get_state", undefined, (raw) => UnverifiedPayloadSchema.parse(raw));
  }

  async getOhlcvSummary(params: OhlcvParams): Promise<UnverifiedPayload> {
    const bars = params.bars ?? undefined;
    if (bars !== undefined && bars > MAX_OHLCV_BARS_PER_CALL) {
      throw new MissingCapabilityError(
        "data_get_ohlcv bar count",
        `requested ${bars} bars, but the tool is hard-capped at ${MAX_OHLCV_BARS_PER_CALL} per call`,
      );
    }
    return this.invoke(
      "data_get_ohlcv",
      { symbol: params.symbol, timeframe: params.timeframe, bars, summary: true },
      (raw) => UnverifiedPayloadSchema.parse(raw),
    );
  }

  getStudyValues(): Promise<UnverifiedPayload> {
    return this.invoke("data_get_study_values", undefined, (raw) => UnverifiedPayloadSchema.parse(raw));
  }

  /** Not a neutral read — MCP_CAPABILITIES.md documents this as auto-opening
   * the Strategy Tester panel and auto-unhiding a hidden strategy. The
   * calling skill must have already confirmed this with the user before the
   * first call in a session, per each SKILL.md's hard constraints. */
  getStrategyResults(params: StrategyResultsParams = {}): Promise<RawStrategyResults> {
    return this.invoke("data_get_strategy_results", params as Record<string, unknown>, (raw) =>
      RawStrategyResultsSchema.parse(raw),
    );
  }

  /** Same side-effect caveat as getStrategyResults. `maxTrades` is passed
   * through to the tool but is not trusted to actually cap the response —
   * see TRADES_MAX_TRADES_PARAM_RELIABLE in capabilities.ts. */
  getTrades(params: TradesParams = {}): Promise<RawTradeFill[]> {
    return this.invoke(
      "data_get_trades",
      { symbol: params.symbol, max_trades: params.maxTrades },
      (raw) => RawTradesResponseSchema.parse(raw),
    );
  }

  /** Always throws: MCP_CAPABILITIES.md verified data_get_equity returns no
   * per-bar data. Fail loudly instead of returning an empty/misleading
   * curve — callers needing an equity curve must reconstruct one from
   * getTrades() fills, per walk-forward.md / monte-carlo.md. */
  getEquityCurve(): never {
    if (!PER_BAR_EQUITY_CURVE_AVAILABLE) {
      throw new MissingCapabilityError(
        "per-bar equity curve",
        "data_get_equity returns no per-bar data (verified) — reconstruct from getTrades() fills instead",
      );
    }
    throw new MissingCapabilityError("per-bar equity curve", "unreachable");
  }
}

export function createMarketDataAdapter(call: RawToolCaller): MarketDataAdapter {
  return new MarketDataAdapter(call);
}

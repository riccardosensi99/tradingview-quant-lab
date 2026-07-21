import { describe, expect, it } from "vitest";
import { interpretHealthCheck } from "../scripts/mcp/health-check.js";

describe("interpretHealthCheck", () => {
  it("returns ready when cdp_connected and api_available are both true", () => {
    const result = interpretHealthCheck({
      success: true,
      cdp_connected: true,
      api_available: true,
      chart_symbol: "FX:USDJPY",
    });
    expect(result.state).toBe("ready");
    expect(result.chartSymbol).toBe("FX:USDJPY");
  });

  it("returns tradingview_unreachable when cdp_connected is false", () => {
    const result = interpretHealthCheck({ success: true, cdp_connected: false, api_available: false });
    expect(result.state).toBe("tradingview_unreachable");
  });

  it("returns unhealthy when api_available is false despite cdp_connected true", () => {
    const result = interpretHealthCheck({ cdp_connected: true, api_available: false });
    expect(result.state).toBe("unhealthy");
  });

  it("returns unhealthy on a malformed/unexpected payload", () => {
    const result = interpretHealthCheck("not an object");
    expect(result.state).toBe("unhealthy");
    expect(result.cdpConnected).toBeNull();
  });

  it("returns unhealthy when the fields are simply absent", () => {
    const result = interpretHealthCheck({});
    expect(result.state).toBe("unhealthy");
  });
});

import { describe, expect, it } from "vitest";
import { loadYaml } from "../scripts/lib/load-yaml.js";
import {
  RiskConfigSchema,
  ScannerConfigSchema,
  ValidationConfigSchema,
} from "../scripts/schemas/config.js";
import { repoPath } from "./test-paths.js";

describe("config/scanner.yaml", () => {
  it("parses and validates the real file with spec defaults applied", () => {
    const config = loadYaml(repoPath("config/scanner.yaml"), ScannerConfigSchema);
    expect(config.max_results).toBe(3);
    expect(config.min_score).toBe(75);
    expect(config.mode).toBe("conservative");
    expect(config.filters.require_validated_strategy).toBe(true);
    expect(config.reporting.save_markdown).toBe(true);
    expect(config.max_bars_per_symbol).toBeLessThanOrEqual(500); // data_get_ohlcv hard cap
  });

  it("rejects min_score outside 0-100", () => {
    const result = ScannerConfigSchema.safeParse({ max_bars_per_symbol: 100, min_score: 150 });
    expect(result.success).toBe(false);
  });
});

describe("config/risk.yaml", () => {
  it("parses and validates the real file", () => {
    const config = loadYaml(repoPath("config/risk.yaml"), RiskConfigSchema);
    expect(config.risk_per_trade_percent).toBe(0.5);
    expect(config.max_total_risk_percent).toBe(1.5);
    expect(config.minimum_risk_reward).toBe(1.8);
    expect(config.allow_martingale).toBe(false);
  });

  it("rejects allow_martingale: true — martingale sizing is a hard-forbidden rule", () => {
    const result = RiskConfigSchema.safeParse({
      risk_per_trade_percent: 0.5,
      allow_martingale: true,
    });
    expect(result.success).toBe(false);
  });

  it("rejects allow_averaging_down: true", () => {
    const result = RiskConfigSchema.safeParse({ allow_averaging_down: true });
    expect(result.success).toBe(false);
  });
});

describe("config/validation.yaml", () => {
  it("parses and validates the real file", () => {
    const config = loadYaml(repoPath("config/validation.yaml"), ValidationConfigSchema);
    expect(config.minimum_out_of_sample_profit_factor).toBe(1.2);
    expect(config.minimum_total_trades).toBe(200);
    expect(config.reject_repainting).toBe(true);
    expect(config.reject_lookahead_bias).toBe(true);
  });

  it("rejects reject_repainting: false — repainting can never be accepted", () => {
    const result = ValidationConfigSchema.safeParse({ reject_repainting: false });
    expect(result.success).toBe(false);
  });
});

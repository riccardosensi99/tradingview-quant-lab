// Composes preflight (registry + config validity), MCP startup evaluation,
// and the decision engine into one LabRunPlan — the data behind
// output-template.md's status block and the READY/ACTION_REQUIRED/BLOCKED/
// NO_ACTION result. Still zero MCP calls: `ctx` carries every live fact
// (health check result, chart state, watchlist count) already gathered by
// the calling agent per mcp-startup.md / SKILL.md, exactly like
// scripts/scanner/assemble-scan-input.ts does for the scanner.

import { join } from "node:path";
import { loadYaml } from "../lib/load-yaml.js";
import { readRegistry } from "../research/registry-io.js";
import { ScannerConfigSchema, RiskConfigSchema, ValidationConfigSchema, type ValidationConfig } from "../schemas/config.js";
import type { StrategyRegistry } from "../schemas/registry.js";
import {
  inspectRegistryState,
  assessNeedsMoreData,
  findLatestReport,
  EMPTY_REGISTRY_STATE,
  type RegistryStateSummary,
  type NeedsMoreDataAssessment,
  type DatedReport,
} from "./inspect-state.js";
import { chooseWorkflow, type WorkflowDecision } from "./choose-workflow.js";
import { evaluateMcpStartup, type McpStartupReport } from "../mcp/startup-manager.js";
import { interpretHealthCheck } from "../mcp/health-check.js";
import type { LabRunFlags } from "./types.js";
import type { ProcessMatch } from "../mcp/process-status.js";
import type { TradingviewMcpConfig } from "../mcp/read-mcp-config.js";

export interface LabRunContext {
  repoRoot: string;
  flags: LabRunFlags;
  asOfIso: string;
  gitBranch: string;
  gitWorkingTreeClean: boolean;
  gitDirtyFiles: string[];
  mcpConfig: TradingviewMcpConfig | null;
  mcpMatchingProcesses: ProcessMatch[];
  mcpToolsAvailableInSession: boolean;
  rawHealthCheck: unknown | null;
  chartSymbol: string | null;
  chartTimeframe: string | null;
  watchlistSymbolCount: number | null;
  reportFileNames: {
    scans: string[];
    backtests: string[];
    validations: string[];
  };
}

export interface LabRunPlan {
  context: LabRunContext;
  registry?: StrategyRegistry;
  systemHealthy: boolean;
  systemErrors: string[];
  registryState: RegistryStateSummary;
  needsMoreDataAssessments: NeedsMoreDataAssessment[];
  mcpStartup: McpStartupReport;
  watchlistAvailable: boolean;
  decision: WorkflowDecision;
  latestScan: DatedReport | null;
  latestBacktest: DatedReport | null;
  latestValidation: DatedReport | null;
}

function tryLoad<T>(label: string, fn: () => T, errors: string[]): T | undefined {
  try {
    return fn();
  } catch (err) {
    errors.push(`${label}: ${(err as Error).message}`);
    return undefined;
  }
}

export function planLabRun(ctx: LabRunContext): LabRunPlan {
  const systemErrors: string[] = [];

  const registry = tryLoad(
    "strategies/registry.yaml",
    () => readRegistry(join(ctx.repoRoot, "strategies", "registry.yaml")),
    systemErrors,
  );
  tryLoad("config/scanner.yaml", () => loadYaml(join(ctx.repoRoot, "config", "scanner.yaml"), ScannerConfigSchema), systemErrors);
  tryLoad("config/risk.yaml", () => loadYaml(join(ctx.repoRoot, "config", "risk.yaml"), RiskConfigSchema), systemErrors);
  const validationConfig: ValidationConfig | undefined = tryLoad(
    "config/validation.yaml",
    () => loadYaml(join(ctx.repoRoot, "config", "validation.yaml"), ValidationConfigSchema),
    systemErrors,
  );

  const systemHealthy = systemErrors.length === 0 && registry !== undefined && validationConfig !== undefined;

  const registryState = registry ? inspectRegistryState(registry, ctx.asOfIso) : EMPTY_REGISTRY_STATE;
  const needsMoreDataAssessments =
    registry && validationConfig
      ? registry.strategies.filter((s) => s.status === "needs_more_data").map((s) => assessNeedsMoreData(s, validationConfig))
      : [];

  const health = ctx.rawHealthCheck !== null ? interpretHealthCheck(ctx.rawHealthCheck) : null;
  const mcpStartup = evaluateMcpStartup({
    config: ctx.mcpConfig,
    matchingProcesses: ctx.mcpMatchingProcesses,
    toolsAvailableInSession: ctx.mcpToolsAvailableInSession,
    health,
  });

  const watchlistAvailable = (ctx.watchlistSymbolCount ?? 0) > 0;

  const decision = chooseWorkflow({
    flags: ctx.flags,
    systemHealthy,
    systemErrors,
    mcpState: mcpStartup.state,
    watchlistAvailable,
    registryState,
    needsMoreDataAssessments,
  });

  return {
    context: ctx,
    registry,
    systemHealthy,
    systemErrors,
    registryState,
    needsMoreDataAssessments,
    mcpStartup,
    watchlistAvailable,
    decision,
    latestScan: findLatestReport(ctx.reportFileNames.scans),
    latestBacktest: findLatestReport(ctx.reportFileNames.backtests),
    latestValidation: findLatestReport(ctx.reportFileNames.validations),
  };
}

/** Renders the "# TradingView Lab Status" block from
 * .claude/skills/tradingview-lab/output-template.md §12. */
export function formatLabStatus(plan: LabRunPlan): string {
  const rs = plan.registryState;
  const lines: string[] = [];

  lines.push("# TradingView Lab Status", "");
  lines.push(`Repository: ${plan.context.repoRoot}`);
  lines.push(`Branch: ${plan.context.gitBranch}`);
  lines.push(`Working tree: ${plan.context.gitWorkingTreeClean ? "clean" : `dirty (${plan.context.gitDirtyFiles.length} file(s))`}`);
  lines.push(`Mode: ${plan.context.flags.mode}`);
  lines.push("");
  lines.push(`MCP configuration: ${plan.mcpStartup.config ? "configured (.mcp.json)" : "not configured"}`);
  lines.push(`MCP process: ${plan.mcpStartup.matchingProcesses.length} matching OS process(es) found (informational only — never used to decide startup)`);
  lines.push(`MCP health: ${plan.mcpStartup.state}`);
  lines.push(`TradingView health: ${plan.mcpStartup.health?.state ?? "not_checked"}`);
  lines.push(`Chart: ${plan.context.chartSymbol ?? "N/D"}${plan.context.chartTimeframe ? ` (${plan.context.chartTimeframe})` : ""}`);
  lines.push(`Watchlist: ${plan.context.watchlistSymbolCount ?? "N/D"} symbol(s)`);
  lines.push("");
  lines.push("Strategies:");
  lines.push(`- experimental: ${rs.counts.experimental}`);
  lines.push(`- validation_pending: ${rs.counts.validation_pending}`);
  lines.push(`- needs_more_data: ${rs.counts.needs_more_data}`);
  lines.push(`- validation_failed: ${rs.counts.validation_failed}`);
  lines.push(`- rejected: ${rs.counts.rejected}`);
  lines.push(`- validated: ${rs.counts.validated}`);
  lines.push("");
  lines.push(`Latest research: ${plan.latestBacktest?.date ?? "N/D"}`);
  lines.push(`Latest validation: ${plan.latestValidation?.date ?? "N/D"}`);
  lines.push(`Latest scan: ${plan.latestScan?.date ?? "N/D"}`);
  lines.push("");
  lines.push(`Blocking issues: ${plan.systemErrors.length > 0 ? plan.systemErrors.join("; ") : "none"}`);
  lines.push(`Recommended workflow: ${plan.decision.workflow ?? "none"}`);
  lines.push(`Reason: ${plan.decision.reason}`);
  lines.push(`Approval required: ${plan.decision.approvalRequired ? "yes" : "no"}`);

  return lines.join("\n");
}

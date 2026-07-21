import { describe, expect, it } from "vitest";
import { chooseWorkflow, type ChooseWorkflowInput } from "../scripts/orchestrator/choose-workflow.js";
import { EMPTY_REGISTRY_STATE } from "../scripts/orchestrator/inspect-state.js";
import { makeLabFlags } from "./orchestrator-fixtures.js";

function baseInput(overrides: Partial<ChooseWorkflowInput> = {}): ChooseWorkflowInput {
  return {
    flags: makeLabFlags(),
    systemHealthy: true,
    systemErrors: [],
    mcpState: "ready",
    watchlistAvailable: true,
    registryState: EMPTY_REGISTRY_STATE,
    needsMoreDataAssessments: [],
    ...overrides,
  };
}

describe("chooseWorkflow", () => {
  it("respects max-actions=0 and does nothing", () => {
    const decision = chooseWorkflow(baseInput({ flags: makeLabFlags({ maxActions: 0 }) }));
    expect(decision.outcome).toBe("NO_ACTION");
    expect(decision.workflow).toBeNull();
  });

  it("BLOCKED when configs/registry are invalid, before anything else is considered", () => {
    const decision = chooseWorkflow(baseInput({ systemHealthy: false, systemErrors: ["registry.yaml: bad"] }));
    expect(decision.outcome).toBe("BLOCKED");
    expect(decision.reason).toContain("registry.yaml");
  });

  it("respects an explicit --workflow override", () => {
    const decision = chooseWorkflow(baseInput({ flags: makeLabFlags({ workflow: "documentation-sync" }) }));
    expect(decision.outcome).toBe("READY");
    expect(decision.workflow).toBe("documentation-sync");
  });

  it("BLOCKS an explicit --workflow that needs MCP when MCP isn't ready", () => {
    const decision = chooseWorkflow(baseInput({ flags: makeLabFlags({ workflow: "market-scanner" }), mcpState: "tradingview_unreachable" }));
    expect(decision.outcome).toBe("BLOCKED");
    expect(decision.workflow).toBeNull();
  });

  it("respects an explicit --goal generate", () => {
    const decision = chooseWorkflow(baseInput({ flags: makeLabFlags({ goal: "generate" }) }));
    expect(decision.workflow).toBe("strategy-generator");
    expect(decision.approvalRequired).toBe(true);
  });

  it("--goal scan with zero validated strategies returns NO_ACTION, not a fake scan", () => {
    const decision = chooseWorkflow(baseInput({ flags: makeLabFlags({ goal: "scan" }) }));
    expect(decision.outcome).toBe("NO_ACTION");
  });

  it("--goal scan bypasses research priority when validated strategies exist, even with validation_pending present", () => {
    const decision = chooseWorkflow(
      baseInput({
        flags: makeLabFlags({ goal: "scan" }),
        registryState: { ...EMPTY_REGISTRY_STATE, counts: { ...EMPTY_REGISTRY_STATE.counts, validated: 1, validation_pending: 1 }, validationPendingIds: ["s1"] },
      }),
    );
    expect(decision.outcome).toBe("READY");
    expect(decision.workflow).toBe("market-scanner");
  });

  it("prioritizes validation_pending over everything else in auto mode", () => {
    const decision = chooseWorkflow(
      baseInput({
        registryState: {
          ...EMPTY_REGISTRY_STATE,
          counts: { ...EMPTY_REGISTRY_STATE.counts, validation_pending: 1, validated: 1 },
          validationPendingIds: ["s1"],
        },
      }),
    );
    expect(decision.outcome).toBe("ACTION_REQUIRED");
    expect(decision.workflow).toBe("strategy-validation");
    expect(decision.strategyId).toBe("s1");
  });

  it("picks a resumable needs_more_data strategy over generating new ideas", () => {
    const decision = chooseWorkflow(
      baseInput({
        registryState: { ...EMPTY_REGISTRY_STATE, counts: { ...EMPTY_REGISTRY_STATE.counts, needs_more_data: 1 } },
        needsMoreDataAssessments: [{ id: "s1", resumable: true, hardBlocks: [], resumableGaps: ["walk-forward not yet run"] }],
      }),
    );
    expect(decision.workflow).toBe("strategy-research");
    expect(decision.strategyId).toBe("s1");
  });

  it("does not pick a blocked (non-resumable) needs_more_data strategy — falls through to generate when nothing else qualifies", () => {
    const decision = chooseWorkflow(
      baseInput({
        registryState: { ...EMPTY_REGISTRY_STATE, counts: { ...EMPTY_REGISTRY_STATE.counts, needs_more_data: 1 } },
        needsMoreDataAssessments: [{ id: "sr-volume-zones", resumable: false, hardBlocks: ["config still null"], resumableGaps: [] }],
      }),
    );
    expect(decision.workflow).toBe("strategy-generator");
  });

  it("picks an experimental approved-but-unbacktested strategy ahead of generating new ideas", () => {
    const decision = chooseWorkflow(
      baseInput({
        registryState: { ...EMPTY_REGISTRY_STATE, counts: { ...EMPTY_REGISTRY_STATE.counts, experimental: 1 }, experimentalApprovedNotBacktested: ["s1"] },
      }),
    );
    expect(decision.workflow).toBe("strategy-research");
    expect(decision.strategyId).toBe("s1");
  });

  it("recommends strategy-generator when there are zero validated strategies and no in-progress work", () => {
    const decision = chooseWorkflow(baseInput());
    expect(decision.outcome).toBe("ACTION_REQUIRED");
    expect(decision.workflow).toBe("strategy-generator");
  });

  it("recommends market-scanner when validated strategies exist and the watchlist is available", () => {
    const decision = chooseWorkflow(
      baseInput({ registryState: { ...EMPTY_REGISTRY_STATE, counts: { ...EMPTY_REGISTRY_STATE.counts, validated: 1 } } }),
    );
    expect(decision.outcome).toBe("READY");
    expect(decision.workflow).toBe("market-scanner");
  });

  it("BLOCKS the scanner when validated strategies exist but the watchlist is unavailable", () => {
    const decision = chooseWorkflow(
      baseInput({
        registryState: { ...EMPTY_REGISTRY_STATE, counts: { ...EMPTY_REGISTRY_STATE.counts, validated: 1 } },
        watchlistAvailable: false,
      }),
    );
    expect(decision.outcome).toBe("BLOCKED");
  });

  it("BLOCKS the scanner when validated strategies exist but MCP is not ready", () => {
    const decision = chooseWorkflow(
      baseInput({
        registryState: { ...EMPTY_REGISTRY_STATE, counts: { ...EMPTY_REGISTRY_STATE.counts, validated: 1 } },
        mcpState: "configured",
      }),
    );
    expect(decision.outcome).toBe("BLOCKED");
  });

  it("strategy-generator never requires approval to be skipped due to MCP — it never needs MCP", () => {
    const decision = chooseWorkflow(baseInput({ mcpState: "not_configured" }));
    expect(decision.workflow).toBe("strategy-generator");
    expect(decision.outcome).toBe("ACTION_REQUIRED");
  });

  it("always marks strategy-generator/-research/-validation as approval-required even if --require-approval=false", () => {
    const decision = chooseWorkflow(baseInput({ flags: makeLabFlags({ requireApproval: false }) }));
    expect(decision.workflow).toBe("strategy-generator");
    expect(decision.approvalRequired).toBe(true);
  });

  it("honors --require-approval=false for market-scanner", () => {
    const decision = chooseWorkflow(
      baseInput({
        flags: makeLabFlags({ requireApproval: false }),
        registryState: { ...EMPTY_REGISTRY_STATE, counts: { ...EMPTY_REGISTRY_STATE.counts, validated: 1 } },
      }),
    );
    expect(decision.workflow).toBe("market-scanner");
    expect(decision.approvalRequired).toBe(false);
  });
});

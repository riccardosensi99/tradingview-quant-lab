// Input/flag types for the tradingview-lab orchestrator. Flags are parsed
// "as prose" by the calling agent from the /tradingview-lab invocation text
// (same convention as tradingview-strategy-generator — no CLI parser exists
// or is needed here, see .claude/skills/tradingview-strategy-generator/SKILL.md).

export type LabGoal = "auto" | "generate" | "research" | "validate" | "scan" | "review" | "status" | "docs";
export type LabMode = "quick" | "normal" | "strict";

export type LabWorkflow =
  | "strategy-generator"
  | "strategy-research"
  | "strategy-validation"
  | "market-scanner"
  | "registry-review"
  | "documentation-sync";

export type LabWorkflowFlag = "auto" | LabWorkflow;

export interface LabRunFlags {
  goal: LabGoal;
  mode: LabMode;
  startMcp: boolean;
  workflow: LabWorkflowFlag;
  strategyId?: string;
  market?: string;
  scan?: boolean;
  generateCount: number;
  maxActions: number;
  dryRun: boolean;
  requireApproval: boolean;
}

export const DEFAULT_LAB_FLAGS: LabRunFlags = {
  goal: "auto",
  mode: "normal",
  startMcp: true,
  workflow: "auto",
  generateCount: 3,
  maxActions: 1,
  dryRun: true,
  requireApproval: true,
};

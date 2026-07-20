// Renders a reports/validations/<strategy-id>_<date>.md file from a
// classifyStrategy() result. No frontmatter schema is asserted here (unlike
// backtest-report.ts) — validation-protocol.md is still TODO on the report's
// exact required fields, so this only fixes the criteria-checklist body,
// which is already unambiguous from classify.ts's output.

import type { ClassificationResult } from "./classify.js";

export interface ValidationReportInput {
  strategyId: string;
  date: string;
  classification: ClassificationResult;
}

function renderCriterion(c: ClassificationResult["criteria"][number]): string {
  const mark = c.passed === true ? "PASS" : c.passed === false ? "FAIL" : "UNRESOLVED";
  return `| ${c.name} | ${mark} | ${c.detail} |`;
}

export function renderValidationReport(input: ValidationReportInput): string {
  const { classification } = input;
  const rows = classification.criteria.map(renderCriterion).join("\n");
  const table =
    classification.criteria.length > 0
      ? `| Criterion | Result | Detail |\n|---|---|---|\n${rows}`
      : "_(no criteria evaluated)_";

  return `---
strategy_id: ${input.strategyId}
date: ${input.date}
status: ${classification.status}
---

## Classification

**Status:** ${classification.status}

${classification.rationale}

## Criteria

${table}
`;
}

# Output format

## Status block

Rendered by `formatLabStatus()` (`scripts/orchestrator/plan-lab-run.ts`) at the start of every run:

```
# TradingView Lab Status

Repository: <repoRoot>
Branch: <gitBranch>
Working tree: clean | dirty (N file(s))
Mode: quick | normal | strict

MCP configuration: configured (.mcp.json) | not configured
MCP process: N matching OS process(es) found (informational only — never used to decide startup)
MCP health: <one of the 8 McpStartupState values>
TradingView health: ready | unhealthy | tradingview_unreachable | not_checked
Chart: <symbol> (<timeframe>) | N/D
Watchlist: <N> symbol(s) | N/D

Strategies:
- experimental: N
- validation_pending: N
- needs_more_data: N
- validation_failed: N
- rejected: N
- validated: N

Latest research: <YYYY-MM-DD> | N/D
Latest validation: <YYYY-MM-DD> | N/D
Latest scan: <YYYY-MM-DD> | N/D

Blocking issues: <list> | none
Recommended workflow: <LabWorkflow> | none
Reason: <chooseWorkflow()'s reason string>
Approval required: yes | no
```

## Result block

After the status block, exactly one of:

- **## READY** — system operational, workflow selected, can proceed once (if required) approved.
- **## ACTION REQUIRED** — a workflow is selected but needs explicit human approval before delegation.
- **## BLOCKED** — a real dependency is missing (config/registry error, MCP not ready, no watchlist).
- **## NO ACTION** — nothing safe or useful to run right now.
- **## COMPLETED** — the delegated workflow finished this run.

Each result block always shows: workflow chosen, reason, delegated skill (if any), files read, MCP tools used (if any), changes made (if any, only after completion), reports generated (if any), the registry's next expected state, and the recommended next step.

## Audit

`reports/lab-runs/audit.jsonl` — one append-only JSON line per run, fields per `scripts/orchestrator/audit.ts`'s `LabAuditRecord` (run id, timestamps, goal/mode, initial strategy counts, MCP state, whether this run started a server and with what command/PID, TradingView health, workflow chosen, delegated skill, strategy id, files modified, MCP tools invoked, approvals granted, outcome, errors, duration, next step). No secrets: the startup command/args come straight from the already-committed `.mcp.json`; environment values are never recorded.

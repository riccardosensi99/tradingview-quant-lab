# State machine

Implemented in `scripts/orchestrator/choose-workflow.ts`'s `chooseWorkflow()` — a pure function, fully covered by `tests/choose-workflow.test.ts`. This file explains the "why" behind the branch order; the code is the source of truth for the exact logic.

## Inputs

`ChooseWorkflowInput`: the parsed flags, whether the system is healthy (configs + registry both load and validate), the current `McpStartupState` (`scripts/mcp/startup-manager.ts`), whether the watchlist is available, and the registry state summary + per-strategy `needs_more_data` assessments (`scripts/orchestrator/inspect-state.ts`).

## Outcomes

- `READY` — a workflow is selected and can run right now (MCP requirement, if any, is already satisfied).
- `ACTION_REQUIRED` — a workflow is selected but needs human approval before it runs (the default for anything that touches the registry).
- `BLOCKED` — a real dependency is missing (bad config, MCP not ready, no watchlist) — no workflow is proposed.
- `NO_ACTION` — nothing safe or useful to do right now (e.g. an explicit scan request with zero validated strategies, or `--max-actions 0`).

## Branch order

1. `max-actions < 1` → `NO_ACTION`.
2. System unhealthy (config/registry load or schema failure) → `BLOCKED`, workflow `null`. This is checked before anything MCP-related — a broken config file is a repo problem, not an MCP problem.
3. `--workflow` explicitly set (not `auto`) → that workflow, gated only by its own MCP requirement (see below).
4. `--goal scan` → `market-scanner` if `validated` strategies exist, else `NO_ACTION` (never a scan that can only produce NO TRADE).
5. `--goal` explicitly set to anything else → the matching workflow (`generate→strategy-generator`, `research/validate→strategy-research/-validation`, `review/status→registry-review`, `docs→documentation-sync`).
6. `goal=auto`, `workflow=auto` — priority order:
   1. `validation_pending` entries exist → `strategy-validation` on the first one.
   2. A resumable `needs_more_data` entry exists → `strategy-research` on it.
   3. An `experimental` (non-`idea`-stage) entry has Pine code but no backtest report → `strategy-research` on it.
   4. Zero `validated` strategies → `strategy-generator`.
   5. Otherwise (at least one `validated` strategy) → `market-scanner`, gated on watchlist availability.

## MCP gating

Each workflow declares whether it needs MCP (`strategy-research`, `strategy-validation`, `market-scanner` do; `strategy-generator`, `registry-review`, `documentation-sync` never call MCP at all, matching their existing `SKILL.md`s). The check happens **at the point a workflow is about to be returned**, not as a blanket precondition — this is why `strategy-generator` stays reachable even when MCP is completely unconfigured (verified by `tests/choose-workflow.test.ts`'s "never requires approval to be skipped due to MCP" case).

`mcpReady()` treats both `ready` and `already_running` as sufficient — `already_running` means the tools already respond in this session but no fresh `tv_health_check` has confirmed liveness yet; a workflow that actually needs MCP should still trigger its own live health check as its first live step (each research/scanner `SKILL.md` already opens with `chart_get_state`).

## Approval

`WORKFLOWS_ALWAYS_REQUIRING_APPROVAL = {strategy-generator, strategy-research, strategy-validation}` — these can add strategies, write Pine-adjacent research reports, or move `status`/`stage`, so they require approval unconditionally (see [approval-gates.md](approval-gates.md)). `market-scanner`, `registry-review`, `documentation-sync` follow `--require-approval` (default `true`).

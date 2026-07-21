# 0004. Orchestrator delegates, never re-implements; MCP readiness is judged by tool availability, not by scanning processes

Status: Accepted
Date: 2026-07-21

## Context

`tradingview-lab` needed to become the single entry point coordinating the three existing skills (`tradingview-strategy-generator`, `tradingview-strategy-research`, `tradingview-market-scanner`), plus a "start/check the MCP server" responsibility none of them had. Two design questions came up while building it:

1. Should the orchestrator's `scripts/orchestrator/` modules contain their own copies of gap-analysis, scoring, or validation logic to decide what to do next, or call into the existing `scripts/generation/`, `scripts/scanner/`, `scripts/validation/` modules?
2. How should "is the MCP server up, and should this skill start it?" actually be decided? The original design assumed a conventional process-manager shape (detect via `ps`, spawn if absent, track a PID). Live verification during design, however, found **three separate orphaned `node tradingview-mcp/src/server.js` processes already running** on the reference machine (leftovers from prior Claude Code session restarts), while the current session's `mcp__tradingview__*` tools were already working normally. `ps`-based detection cannot distinguish "the process wired to this session" from an unrelated orphan.

## Decision

**On (1):** the orchestrator only ever composes existing, already-tested modules — `readRegistry`/`upsertStrategy` (`scripts/research/registry-io.ts`), `StrategyRegistrySchema` (`scripts/schemas/registry.ts`) — plus new, narrowly-scoped pure functions of its own (`inspectRegistryState`, `assessNeedsMoreData` in `scripts/orchestrator/inspect-state.ts`; `chooseWorkflow` in `scripts/orchestrator/choose-workflow.ts`) that only look at registry/config state to pick a workflow. It never imports or duplicates `scripts/generation/registry-analysis.ts`'s gap-analysis, `scripts/scoring/`, or `scripts/validation/classify.ts` — those stay exactly where they are, owned by the skills that already use them. The orchestrator's `SKILL.md` explicitly hands off to the existing skill once a workflow is chosen, with a structured context object, not inline logic.

**On (2):** the orchestrator treats **whether `mcp__tradingview__*` tools currently respond in this Claude Code session** as the sole authoritative readiness signal (`toolsAvailableInSession` in `scripts/mcp/startup-manager.ts`'s `McpStartupInput`). A live `tv_health_check` call (made by the agent, interpreted by the pure `interpretHealthCheck()` in `scripts/mcp/health-check.ts`) confirms actual liveness once tools are available. OS-level process matches (`scripts/mcp/process-status.ts`) are carried through the report purely as an informational count for the status block — the decision logic never branches on them. `scripts/mcp/start-server.ts`'s `startServer()` exists for the one case where tools are genuinely unavailable in-session, and requires an explicit `confirmed: true` the caller can only set after the user approves that specific action for that specific run — there is no default path that spawns a process automatically for this repo's stdio-configured server, since Claude Code's own harness already owns that spawn at session start.

## Alternatives considered

- **`scripts/orchestrator/` re-implementing a simplified version of gap-analysis/scoring/validation** for speed. Rejected: would violate STEERING.md's explicit instruction that a new score/regime/validation change is "a new pure function with its own test file" living in its existing module family (§20), and would create two divergent copies of logic that must stay in sync by hand.
- **`ps`-based process detection as the primary readiness signal**, spawning a new server whenever no matching process is found. Rejected outright once live verification showed this would have produced a false `not_configured`/`start`-worthy read in a session where tools already worked fine, and would have added a fourth orphan process to the three already found — exactly the "duplicate instance" failure this skill was asked to prevent.
- **Auto-starting the server whenever `toolsAvailableInSession` is false**, without asking. Rejected: for this repo's stdio transport, that state means "this session hasn't loaded `.mcp.json`," which a spawn cannot fix (a new process would not be the one wired to this session's stdio pipes) — the correct remedy is a session restart, which the orchestrator states plainly rather than attempting a technically-plausible-but-wrong workaround.

## Consequences

- Every workflow decision the orchestrator makes is fully unit-testable without a live TradingView session or a live MCP connection (`tests/choose-workflow.test.ts`, `tests/inspect-state.test.ts`, `tests/startup-manager.test.ts`), consistent with ADR 0001's existing guarantee for the rest of the domain layer.
- A future non-stdio MCP transport (e.g. an HTTP-based server a script genuinely could start and own) would still fit this design — `startServer()`/`evaluateMcpStartup()` don't assume stdio, they just document that spawning is inappropriate for *this* repo's current stdio configuration.
- Orphaned server processes from past session restarts are left alone by design; this skill reports their count but never terminates a process it did not itself start with explicit confirmation.

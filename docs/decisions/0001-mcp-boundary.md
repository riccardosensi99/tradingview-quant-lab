# 0001. MCP calls only from the calling agent, never from scripts/

Status: Accepted
Date: 2026-07-20

## Context

The `tradingview` MCP server exposes 84 tools over stdio to whatever process Claude Code's harness connects it to. Only the agent actually executing a skill session has that connection — a plain Node.js script run via `node` (e.g. anything under `scripts/`) has no access to `mcp__tradingview__*` tools; there is no separate client library or bridge for scripted, out-of-session access.

Given that, the domain logic (regime classification, scoring, risk math, validation classification, scanner ranking) needed a way to be written and tested without requiring a live TradingView Desktop session for every run.

## Decision

`scripts/` code never calls an MCP tool. All live data enters the system through `scripts/adapter/market-data-adapter.ts`, which takes an injected `RawToolCaller` function — in a real skill run, that function is the calling agent performing the actual MCP call and handing back the result; in tests, it's a fixture-backed fake. Every other module downstream of the adapter (`regime/`, `scoring/`, `risk/`, `validation/`, `research/`, `scanner/`) operates purely on already-fetched, adapter-validated data.

## Alternatives considered

- **A Node-side MCP client** that connects to the `tradingview` MCP server directly from `scripts/`, independent of the Claude Code session. Rejected: this would duplicate the harness's own MCP client, require managing a second live connection with its own lifecycle/auth, and doesn't match how the two skills are actually invoked (as Claude Code skills, not standalone CLI programs).
- **No boundary at all** — let any module call MCP tools where convenient. Rejected: this was the fastest path but would have made every domain module untestable without a live TradingView session, and would have scattered capability guards (e.g. the 500-bar OHLCV cap) and audit logging across many call sites instead of one.

## Consequences

- The entire domain layer (140 tests as of this writing) runs with zero network dependency and zero TradingView Desktop requirement.
- Capability guards (§9 in STEERING.md) and audit logging are enforced in exactly one place, by construction — a new MCP tool use can't accidentally skip them.
- The tradeoff: a live skill run's "gather evidence" step is still manual/prose-driven (the agent follows SKILL.md's numbered steps and feeds results into the pipeline via `assembleScanInput` or similar) rather than a single scripted call — there is no `runFullLiveScan()` entrypoint, and there isn't expected to be one under this architecture.

# Architecture Decision Records

An ADR captures a decision significant enough to constrain future work, at the point it was made — including the alternatives considered and why they were rejected. Not every decision needs one: routine, easily-reversed choices belong in code comments or a PR description; a decision another contributor (or a future session) would otherwise have to re-derive from scratch belongs here.

`STEERING.md` §18 ("Decisioni architetturali permanenti") lists the current decisions in effect as a flat summary. An ADR is the longer-form record for a decision worth explaining in full — reference the ADR number from STEERING.md when one exists.

## Format

One file per decision: `NNNN-short-title.md`, numbered sequentially, never renumbered or reused even if a later ADR supersedes an earlier one (mark the old one `Superseded by NNNN` instead).

```markdown
# NNNN. Short title

Status: Proposed | Accepted | Superseded by NNNN
Date: YYYY-MM-DD

## Context
What problem or fork in the road prompted this. What constraints applied.

## Decision
What was actually decided, stated plainly.

## Alternatives considered
What else was on the table, and why it lost.

## Consequences
What this makes easier, what it makes harder, what it forecloses.
```

## Index

- [0001 — MCP calls only from the calling agent, never from scripts/](0001-mcp-boundary.md)
- [0002 — Hard risk/validation rules enforced at the schema level](0002-schema-enforced-hard-rules.md)
- [0003 — Idea-stage registry entries with no Pine code or backtest evidence](0003-idea-stage-registry-entries.md)
- [0004 — Orchestrator delegates, never re-implements; MCP readiness is judged by tool availability, not by scanning processes](0004-orchestrator-mcp-startup-boundary.md)

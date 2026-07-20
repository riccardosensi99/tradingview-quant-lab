---
name: tradingview-strategy-generator
description: Use when generating new, falsifiable trading strategy hypotheses to fill gaps in the strategy portfolio — e.g. "genera nuove idee di strategia", "trova un gap nel portfolio", "proponi un'ipotesi per il mercato range". Reads strategies/registry.yaml and (only after explicit human approval) writes new status=experimental, stage=idea entries plus a report to reports/ideas/. Never calls the tradingview MCP server, never backtests, never writes Pine code.
---

# TradingView Strategy Generator

Surveys `strategies/registry.yaml` for coverage gaps, generates falsifiable hypotheses to fill them, runs each one through explicit originality and quality gates, and — only after the human operator explicitly approves the resulting report — registers the approved ideas at `status: experimental`, `stage: idea`. This is the first stage of the strategy lifecycle (`idea → backtest → walk_forward → monte_carlo → paper → live`, see [STEERING.md §6](../../../STEERING.md#6-lifecycle-delle-strategie)); once an idea is approved here, a Pine script is written for it by hand and [tradingview-strategy-research](../tradingview-strategy-research/SKILL.md) picks it up from `stage: backtest` onward.

The gap-analysis, originality-check, quality-gate, and report-rendering logic this skill runs on is implemented and tested in `scripts/generation/` (plus the internal hypothesis schema in `scripts/schemas/hypothesis.ts`) — none of it calls MCP tools or touches disk except the one explicit registry write at the very end (see [STEERING.md §3](../../../STEERING.md#3-architettura-generale)). See [generation-protocol.md](generation-protocol.md), [hypothesis-template.md](hypothesis-template.md), [quality-gates.md](quality-gates.md), [output-template.md](output-template.md), and [registry-integration.md](registry-integration.md) for what each part actually does. This file defines the process contract: what the agent does, in what order, and where it must stop for approval.

## Inputs

- `strategies/registry.yaml` (read-only until the final, approval-gated write) and `config/validation.yaml`/`config/risk.yaml` for context on what's already required downstream
- Optional CLI-style flags typed after the slash command (this skill has no argument parser — the agent reads them as prose):

| Flag | Default | Meaning |
|---|---|---|
| `--count` | `3` | how many ideas to propose |
| `--market` | unconstrained — inferred from the gap analysis | restrict target markets (e.g. `forex`) |
| `--symbols` | unconstrained | restrict initial symbols (comma-separated) |
| `--timeframes` | unconstrained | restrict candidate timeframes (comma-separated) |
| `--regime` | unconstrained — gaps in `config/scanner.yaml`'s 8 regime categories are preferred | target a specific regime |
| `--family` | unconstrained | target a specific strategy family |
| `--session` | `all` | restrict session coverage |
| `--direction` | `both` | `long`, `short`, or `both` |
| `--novelty` | `medium` | how much overlap with the existing registry is tolerated before `originality-check.ts` downgrades the verdict |
| `--complexity` | `low` or `medium` | excludes `high` unless explicitly requested |
| `--target-frequency` | `medium` | expected trade frequency |

## Process

1. Read `strategies/registry.yaml` and run `analyzeRegistryGaps()` (`scripts/generation/registry-analysis.ts`) — grouping by status/family/market/timeframe/regime/session/direction, `needs_more_data` entries, overrepresented families, concrete gaps. See [generation-protocol.md](generation-protocol.md).
2. Author up to `--count` candidate hypotheses against the gaps found and the taxonomy in [generation-protocol.md](generation-protocol.md), each shaped per [hypothesis-template.md](hypothesis-template.md) (`HypothesisIdeaSchema` in `scripts/schemas/hypothesis.ts`) — every deterministic rule stated as a measurable condition, every initial parameter explicitly marked as a starting point for research, not a proven value.
3. For each candidate: `checkOriginality()` (`scripts/generation/originality-check.ts`) against the registry, then `runQualityGates()` (`scripts/generation/quality-gates.ts`) per [quality-gates.md](quality-gates.md).
4. Discard any candidate that fails a quality gate, recording why (duplication, technical limit, unresolvable data requirement — see [quality-gates.md](quality-gates.md)).
5. Render the report (`renderIdeaReport()`, `scripts/generation/idea-report.ts`) per [output-template.md](output-template.md) and write it to `reports/ideas/<YYYY-MM-DD>_<HHmm>_generation.md`.
6. **Stop. Present the report and wait for the human operator's explicit approval before touching the registry.** Do not proceed past this point automatically, even if every proposed idea passed its quality gates.
7. On approval only: `buildExperimentalEntry()` for each approved idea, `commitApprovedIdeas()` to fold them into the in-memory registry, then `writeRegistry()` (`scripts/research/registry-io.ts` — reused, not duplicated) to persist `strategies/registry.yaml`. See [registry-integration.md](registry-integration.md).

## Hard constraints

Full rationale and which of these are also enforced in code: [STEERING.md §8-9](../../../STEERING.md#8-regole-mcp). Summary for this skill specifically:

- Never call any `mcp__tradingview__*` tool, for any reason — this skill never touches TradingView Desktop or the MCP server, unlike its two sibling skills
- Never run a backtest, read Strategy Tester data, or call `pine_check`/`pine_analyze`/`pine_compile` — that begins only once `tradingview-strategy-research` picks up an approved idea
- Never call `pine_set_source`, `pine_save`, `pine_new`, or `pine_open` — this skill never writes Pine code
- Never write to `strategies/registry.yaml` before the human operator has explicitly approved the report — step 6 above is a hard stop, not a formality
- Never set `status: validated` — this skill only ever produces `status: experimental`, `stage: idea`
- Never fabricate a backtest metric, a proven edge, or an MCP capability that isn't in `MCP_CAPABILITIES.md` — every numeric parameter is written and reported as an initial research parameter, never as an optimal or proven value
- Never register an idea whose originality check returned `duplicate` or `parameter_stability_candidate` — see [generation-protocol.md](generation-protocol.md)'s §8 rule

## Output

- `reports/ideas/<YYYY-MM-DD>_<HHmm>_generation.md`, format per [output-template.md](output-template.md)
- `strategies/registry.yaml` update (approved ideas only, after step 6's approval), format per `scripts/schemas/registry.ts` and [registry-integration.md](registry-integration.md)

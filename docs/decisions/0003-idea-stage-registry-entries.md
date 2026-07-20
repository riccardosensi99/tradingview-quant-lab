# 0003. Idea-stage registry entries with no Pine code or backtest evidence

Status: Accepted
Date: 2026-07-20

## Context

`strategies/registry.yaml`'s `stage` enum (`idea → backtest → walk_forward → monte_carlo → paper → live`) has included `idea` since the schema was first written, but nothing ever produced an entry there — the one real entry (`sr-volume-zones`) starts at `stage: backtest`, after Pine code and a first backtest already existed. `StrategyRegistryEntrySchema` reflected that assumption: `pine_script_id` and `metrics` (`LegacyMetricsSchema`, 7 non-nullable numbers) were required unconditionally, for every entry regardless of stage.

The new `tradingview-strategy-generator` skill needed to register a formalized hypothesis — a falsifiable idea with deterministic rules and initial research parameters, but zero Pine code and zero backtest data — at `status: experimental`, `stage: idea`. Satisfying the previously-required fields would have meant inventing a `pine_script_id` or fabricating metrics, both directly forbidden by this repo's anti-hallucination rules (STEERING.md §13).

## Decision

`pine_script_id` and `metrics` become optional in `StrategyRegistryEntrySchema`'s shape, but a `superRefine` still requires both whenever `stage !== "idea"`. The relaxation is scoped to exactly the one new legitimate case; every other stage keeps the original guarantee, now enforced explicitly rather than implicitly by every field being required. `tradingview-strategy-generator` is the sole producer of `stage: idea` entries, and only after the human operator has explicitly approved its generation report (see `.claude/skills/tradingview-strategy-generator/registry-integration.md`) — the skill's `buildExperimentalEntry`/`commitApprovedIdeas` functions are deliberately fs-free, so the registry write only happens through a separate, explicit call to the existing `writeRegistry`.

Two purely additive fields were also added to support this and future generation runs querying the registry: `family: z.string().optional()` (an open taxonomy tag, not a closed enum — see `generation-protocol.md`) and `sessions_supported: z.array(z.string()).optional()` (parallel to the existing `regimes_supported`/`directions_supported`/`timeframes_supported`). `ReportsSchema` gained `ideas: z.array(z.string()).default([])`, parallel to the existing `backtests`/`validations` arrays, pointing at the generation report(s) behind an idea-stage entry.

## Alternatives considered

- **Blanket `.optional()` on `pine_script_id`/`metrics`, no `superRefine`.** Rejected: this would have weakened the guarantee for every stage, not just `idea` — a config or code bug could produce a `backtest`-or-later entry silently missing its evidence, with nothing in the schema to catch it. The repo-wide grep run before this change confirmed no consumer code reads these two fields directly today, but that's not a reason to drop the invariant for stages where it's still meaningful.
- **A separate `ideas.yaml` or parallel schema**, instead of extending `StrategyRegistryEntrySchema`. Rejected: `strategies/registry.yaml` is STEERING.md §6's stated single source of truth for strategy status/stage across the whole lifecycle, and the `idea` stage value already existed in the enum specifically to be a point on that one timeline. A second file would fragment that, and every downstream consumer (scanner, validation, future tooling) would need to know about two registries instead of one.
- **A placeholder `pine_script_id`** (e.g. `"TBD"`) or zeroed-out `metrics`. Rejected outright — directly forbidden by the anti-hallucination rule in STEERING.md §13; a `0` profit factor or a fake script ID is not "absence," it's a fabricated, misleading value.

## Consequences

- The registry can now hold strategies with zero Pine/backtest evidence at `stage: idea`; any future code that reads `entry.metrics` or `entry.pine_script_id` must treat both as possibly absent — already true for every other optional field on this schema, but now true earlier in the lifecycle than before.
- The scanner is unaffected: `scripts/scanner/select-strategies.ts` already filters to `status: validated` only, and an idea-stage entry is always `status: experimental`.
- A config or code bug can no longer accidentally leave a `backtest`-or-later entry without evidence — the `superRefine` still rejects that, exactly as it did implicitly before this change.
- Adding a new lifecycle-entry producer later (e.g. a future automated idea source) means following the same pattern: relax only via a scoped `superRefine` condition, never a blanket optional.

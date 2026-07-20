# Quality Gates

Implemented in `scripts/generation/quality-gates.ts` (`runQualityGates`), tested in `tests/quality-gates.test.ts`. Mirrors `scripts/validation/classify.ts`'s pattern from the research skill: every gate reports its own `{name, passed, detail}`, `passed: null` means "could not be evaluated because required information is missing" and is **never** treated as passing. An idea is only `accepted` when every gate is explicitly `true` — automatically discard anything else, per [SKILL.md](SKILL.md)'s process step 4.

## The 10 gates

| Gate | What it checks |
|---|---|
| `falsifiable` | `falsifiability.rejection_conditions` and `key_assumptions` both non-empty; `benchmark` non-empty (else `null`, not a guess at what to compare against) |
| `codifiable` | every applicable `deterministic_rules` field is non-empty (else `null`), and `setup`/`trigger`/`entry`/`stop_loss` each contain a numeric threshold (else `false` — see [hypothesis-template.md](hypothesis-template.md)'s vague→measurable rule) |
| `data_available` | `data_requirements` non-empty (else `null`); none of them depend on a capability `MCP_CAPABILITIES.md` documents as unavailable (per-bar equity curve, Depth of Market, order book, broker execution/account data, subscription tier, rate limits — see `KNOWN_UNAVAILABLE_DATA_KEYWORDS` in `quality-gates.ts`) |
| `no_lookahead` | deterministic-rule text doesn't reference future bars ("next bar", "future close," etc.) — a coarse textual pre-screen only; the real check is `pine_analyze` once Pine code exists, run by `tradingview-strategy-research` |
| `no_repainting_required` | deterministic-rule text doesn't reference repainting behavior — same coarse-pre-screen caveat as above |
| `costs_simulable` | `falsifiability.cost_sensitivity_risks` non-empty (else `null` — cost sensitivity hasn't been considered) |
| `stop_definable` | `stop_loss` and `invalidation` both non-empty (else `null`); `stop_loss` contains a numeric threshold (else `false`) |
| `sufficiently_original` | `checkOriginality()`'s verdict (see [generation-protocol.md](generation-protocol.md)) is not `duplicate` or `parameter_stability_candidate` |
| `complexity_acceptable` | the self-declared `complexity` label is honest relative to the actual parameter count (see below) — not a novelty judgment, a consistency check |
| `parameter_count_acceptable` | `initial_research_parameters.length` is within `[MIN_OPTIMIZABLE_PARAMETERS, MAX_OPTIMIZABLE_PARAMETERS]` |

## Parameter count

Fixed constants in `scripts/generation/quality-gates.ts`, not `config/*.yaml` — the config file count is pinned at 3 by [STEERING.md §18 decision #2](../../../STEERING.md#18-decisioni-architetturali-permanenti), and this follows the same precedent as the scoring engine's fixed component caps (decision #6):

- `MIN_OPTIMIZABLE_PARAMETERS = 3`
- `MAX_OPTIMIZABLE_PARAMETERS = 6`
- Complexity-consistency caps (`COMPLEXITY_PARAMETER_CAPS`): `low` ≤ 4, `medium`/`high` ≤ 6 (the same repo-wide ceiling — no complexity tier is allowed to exceed it)

Risk-management thresholds (`config/risk.yaml`) are excluded from this count — they're global, not per-strategy. No combinatorial parameter search, no per-symbol logic without an explicit reason, no opportunistic feature selection: an idea proposing dozens of optional filters fails `complexity_acceptable`/`parameter_count_acceptable` by design.

## What "discard immediately" means

A discarded idea still appears in the generation report's "Idee scartate immediatamente" section (per [output-template.md](output-template.md)) with its name, reason, any duplication found, the specific technical gate(s) that failed, and the overfitting-risk label of each proposed parameter — discarding is not silent.

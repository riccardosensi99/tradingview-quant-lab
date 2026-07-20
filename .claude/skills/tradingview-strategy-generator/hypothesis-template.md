# Hypothesis Template

Source of truth: `HypothesisIdeaSchema` in `scripts/schemas/hypothesis.ts` — this file is a human-readable checklist of that schema, not an independent spec. If the two ever disagree, the schema wins and this file is out of date.

## Translating a vague concept into a measurable rule

Every `deterministic_rules` field must be a condition that could be evaluated mechanically from data, not a feeling about the chart.

**Not admitted**: "trend forte" ("strong trend")

**Admitted**: "ADX(14) above a configurable threshold, HH/HL structure across the last N swings, and price above a moving average with positive slope" — or, more concretely, e.g. `regime_filter`: "ADX(14) > 25 on the setup timeframe, read at the close of the trigger bar"

`scripts/generation/quality-gates.ts`'s `codifiable` gate enforces a coarse version of this mechanically: `setup`, `trigger`, `entry`, and `stop_loss` must each contain a numeric threshold, not just prose.

## Fields (one `HypothesisIdea` per proposed strategy)

**Identity**: `id`, `name`, `family` (see [generation-protocol.md](generation-protocol.md)'s taxonomy), `version`, `synthesis` (one-paragraph summary)

**The hypothesis itself**: `market_behavior_exploited` (what pattern in market behavior this trades), `economic_or_behavioral_rationale` (why that pattern might exist — never "because it worked in a backtest," there is no backtest yet)

**Scope**: `target_markets`, `initial_symbols` (at least one), `compatible_providers`, `timeframe_context` / `timeframe_setup` / `timeframe_trigger`, `target_regimes`, `excluded_regimes`, `sessions`, `directions` (`long` and/or `short`), `expected_frequency`, `complexity` (`low`/`medium`/`high`)

**Data**: `data_requirements`, `volume_dependency` (boolean), `multi_symbol_dependency` (boolean), `expected_cost_sensitivity` (`low`/`medium`/`high`)

**`deterministic_rules`** (every value a measurable condition, per the translation rule above): `regime_filter`, `htf_filter`, `setup`, `trigger`, `entry`, `stop_loss`, `invalidation`, `target`, `early_exit`, `time_stop`, `unclosed_bar_handling`, `cooldown`, `pyramiding`, `direction_long` (only if `directions` includes `long`), `direction_short` (only if `directions` includes `short`), `session_rules`, `exclusions`, `gap_handling`, `exceptional_volatility_handling`

**`initial_research_parameters`** (at least one; see [quality-gates.md](quality-gates.md) for the count limits) — each one: `name`, `initial_value`, `search_range`, `rationale`, `overfitting_risk` (`low`/`medium`/`high`). These are **starting points for research, never claimed-optimal values** — see [registry-integration.md](registry-integration.md) for how this framing is preserved all the way into the registry entry.

**`falsifiability`** — see [quality-gates.md](quality-gates.md)'s `falsifiable` gate: `rejection_conditions` (at least one — what would make this `rejected`), `needs_more_data_conditions`, `key_assumptions` (at least one), `possible_biases`, `cost_sensitivity_risks`, `excluded_markets`, `benchmark`, `contrary_signals`

**`differentiation_notes`** — how this idea differs from what's already in `strategies/registry.yaml`, informed by `checkOriginality()`'s verdict (see [generation-protocol.md](generation-protocol.md))

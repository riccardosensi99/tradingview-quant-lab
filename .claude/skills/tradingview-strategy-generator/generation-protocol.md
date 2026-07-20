# Generation Protocol

Implemented in `scripts/generation/registry-analysis.ts` (`analyzeRegistryGaps`) and `scripts/generation/originality-check.ts` (`checkOriginality`), tested in `tests/registry-analysis.test.ts` and `tests/originality-check.test.ts`. This file fixes the portfolio-survey method and the family taxonomy — see [STEERING.md §6-7](../../../STEERING.md#6-lifecycle-delle-strategie) for how this feeds the rest of the lifecycle.

## Portfolio survey (`analyzeRegistryGaps`)

Groups every entry in `strategies/registry.yaml` along seven dimensions and returns the full breakdown, not just a verdict:

- **status** — `experimental` / `validation_pending` / `validated` / `disabled` / `rejected` / `needs_more_data` / `validation_failed`
- **family** — the entry's `family` tag, or bucketed as `unspecified` if absent
- **market** — the exchange prefix parsed from `symbol_universe` (e.g. `FX:USDJPY` → `FX`)
- **timeframe** — the entry's `timeframe` field
- **regime** — each value in `regimes_supported`, or `unspecified` if the entry declares none
- **session** — each value in `sessions_supported`, or `unspecified` if the entry declares none
- **direction** — each value in `directions_supported`, or `unspecified` if the entry declares none

From these, the analysis also reports:

- every entry currently at `status: needs_more_data` (these are candidates for a research follow-up, not a new idea, per [SKILL.md](SKILL.md))
- **overrepresented families**: a family is flagged once it has at least 2 entries *and* its share of the registry exceeds `OVERREPRESENTATION_SHARE_THRESHOLD` (0.4, fixed constant — see `scripts/generation/registry-analysis.ts`; not config, per [STEERING.md §18 decision #2](../../../STEERING.md#18-decisioni-architetturali-permanenti) pinning the config file count at 3)
- concrete **gaps**: no validated strategy yet, no long/short-direction strategy, no strategy targeting one of the 8 canonical `MARKET_REGIMES` (`scripts/regime/types.ts` — reused, not a new taxonomy), low or absent family diversity, no session coverage declared, and each overrepresented family named explicitly

An empty registry produces zero counts and a single gap noting that any well-formed hypothesis is a legitimate first entry — it is never treated as an error.

## Originality check (`checkOriginality`)

Compares a candidate idea against every existing registry entry using only what the registry actually stores (`family`, `regimes_supported`, `directions_supported`, `parameters.initial_research_parameters`, and free-text `description`/`notes` — the full deterministic-rules text of a past idea lives only in its own report, not in the registry). A deterministic token-overlap heuristic, not fuzzy/ML matching:

1. No shared `family` → `new`, regardless of anything else.
2. Shared `family` but no overlap in `target_regimes`/`directions` → `new`.
3. Shared family + regime + direction, and the idea's descriptive text (synthesis, market behavior, rationale, all deterministic-rule text) shares at least `DUPLICATE_TEXT_OVERLAP_TOKENS` (5) significant words with the matched entry's `description`/`notes` → `duplicate`.
4. Shared family + regime + direction, not enough text overlap for (3), but the proposed parameter *names* overlap at least `PARAMETER_NAME_OVERLAP_RATIO` (0.5) with the matched entry's stored `initial_research_parameters` → `parameter_stability_candidate` (same setup, different threshold — this should become a parameter-stability experiment on the existing strategy, not a new registry entry).
5. Otherwise (shared family + some dimension overlap, but distinguishable) → `variant_of_existing`.

When multiple entries match, the strongest verdict wins (`duplicate` > `parameter_stability_candidate` > `variant_of_existing` > `new`). Per [quality-gates.md](quality-gates.md), only `duplicate` and `parameter_stability_candidate` fail the `sufficiently_original` gate — `variant_of_existing` is allowed through, since the checker's own definition already means it's meaningfully different.

## Family taxonomy

Illustrative, **non-exhaustive** categories — `family` is a free string (`z.string().optional()` on `StrategyRegistryEntrySchema`), not a closed enum, since this list is expected to grow:

trend pullback · breakout and retest · momentum expansion · volatility compression breakout · range mean reversion · liquidity sweep reversal · opening range breakout · session breakout · intraday reversal · time-series momentum · channel breakout · structural continuation · volatility-adjusted trend · cross-sectional relative strength (only if the available data supports it) · pairs/spread logic (only if the framework supports multi-symbol data) · regime-switching (only if implementable without look-ahead)

These are tags for gap analysis and originality checking, not automatically-valid strategies — every idea still has to clear every gate in [quality-gates.md](quality-gates.md) regardless of which family it claims.

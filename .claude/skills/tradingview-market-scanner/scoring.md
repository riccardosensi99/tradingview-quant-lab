# Scoring

Implemented in `scripts/scoring/` (`scripts/scoring/types.ts`, `scoring-engine.ts`, `regime-component.ts`, `mtf-component.ts`) and tested in `tests/scoring-engine.test.ts`, `tests/regime-component.test.ts`, `tests/mtf-component.test.ts`. Full architectural context: [STEERING.md §11](../../../STEERING.md#11-regole-di-scoring).

None of this code calls MCP tools — it's pure aggregation over data the scanning skill already read live (per SKILL.md's Process).

## Components

Exactly 9 fixed components, summing to 100 (`SCORE_COMPONENT_MAX` in `scripts/scoring/types.ts`; the sum is asserted by a dedicated test):

| Component | Max | Concrete scorer implemented? |
|---|---|---|
| `regime` | 15 | Yes — `scoreRegimeComponent()`: proportional to the regime classification's confidence (0 if `uncertain`) |
| `multi_timeframe` | 15 | Yes — `scoreMtfAlignment()`: full marks if HTF/LTF direction match, 0 if they conflict, half if either is sideways, 0 if either is unknown |
| `level` | 15 | Not yet — see below |
| `setup_confirmation` | 15 | Not yet |
| `volatility_liquidity` | 10 | Not yet |
| `volume` | 10 | Not yet |
| `risk_reward` | 10 | Not yet — but the underlying R:R math (`computeRiskReward` in `scripts/risk/position-sizing.ts`) is implemented; only the "map R:R to a 0-10 score" step isn't |
| `space` | 5 | Not yet |
| `session` | 5 | Not yet |

**Why 7 of 9 have no dedicated scorer function yet:** they need domain data this repo doesn't have a computation for (support/resistance level quality, a session-liquidity calendar, etc.) — see [STEERING.md §20](../../../STEERING.md#20-future-extension-guidelines) for the standing rule: don't invent a scoring formula that isn't grounded in real, verified data. Until then, `computeScore()` still requires all 9 components to be present (it throws otherwise, per its no-missing-component check) — the caller must supply an honest `{value, max, rationale, dataUsed}` for each, including a `0` with a stated rationale like "no S/R level data available this run" where real evidence is missing. Adding a concrete scorer for one of these follows the same pattern as `regime-component.ts`: a pure function, its own test file.

## Aggregation (`computeScore`)

- Every component's `value` must be within `[0, max]` and `max` must equal the fixed cap for that name — a mismatch throws.
- `rawTotal` = sum of the 9 component values. Penalties (each a `{name, points, rationale}`, `points` negative) are added on top; `finalScore` is clamped to `[0, 100]`.
- Tiers are fixed: `finalScore >= 90` → `exceptional`, `>= 80` → `strong`, `>= 75` → `valid`, otherwise `below_75` (`scoreTier()` in `scoring-engine.ts`).
- Whether a candidate is actually shown is a **separate** gate from the tier: `excluded` is `true` if `finalScore < config/scanner.yaml`'s `min_score` (default 75) **or** any `ExclusionFlags` entry is set — `insufficientData`, `strategyNotValidated`, `unsupportedProvider`, `unsupportedTimeframe`, `unsupportedRegime`, `disorderedMarket`, `correlationExcluded`, `insufficientRiskReward`, `staleData`, `triggerNotConfirmed`, `htfConflict`. A hard exclusion overrides any score, including 100.
- The score is never adjusted after the fact to force a candidate to appear.

## Thresholds

Live in `config/scanner.yaml`: `min_score` (default 75), `max_results` (default 3), `mode` (default `conservative`). Not hardcoded here or in the scoring code.

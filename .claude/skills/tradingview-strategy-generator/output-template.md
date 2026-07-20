# Output Template

Rendered by `scripts/generation/idea-report.ts` (`renderIdeaReport`) from a `RegistryGapAnalysis` (`registry-analysis.ts`) plus a list of proposed/discarded `{idea, originality, gates}` entries. Written to `reports/ideas/<YYYY-MM-DD>_<HHmm>_generation.md`. Tested in `tests/idea-report.test.ts`, including a determinism check (identical input → identical output string).

**Anti-fabrication rule enforced by the renderer**: every `initial_research_parameters` entry is rendered with its `search_range` and `overfitting_risk` alongside the `initial_value`, under a section header stating explicitly that these are starting points for research, not optimal values. A quality gate result of `null` renders as `"no (dati insufficienti)"`, never as a silent `"sì"` — see [quality-gates.md](quality-gates.md).

## Structure

1. **Header** (frontmatter + prose) — UTC date/time, registry path, strategy count, strategies-per-status breakdown, gaps found (from `analyzeRegistryGaps`), constraints received (the `--flag value` args the skill was invoked with, or a note that none were given)
2. **Idee scartate immediatamente** — one entry per discarded idea: synthetic name, reason, duplication found (if any, via `checkOriginality`), technical limit (which quality gate(s) failed and why), overfitting risk per proposed parameter
3. **Idee proposte** — one numbered section per surviving idea, in this fixed order:
   - Identity block: ID proposto, Famiglia, Stato proposto (`experimental`), Mercati target, Simboli iniziali, Timeframe (contesto/setup/trigger), Regimi target, Regimi esclusi, Sessioni, Direzioni, Frequenza attesa, Complessità
   - **Ipotesi** — synthesis + market behavior exploited
   - **Motivazione economica o comportamentale**
   - **Regole deterministiche preliminari** — the full `deterministic_rules` object (see [hypothesis-template.md](hypothesis-template.md) for every field)
   - **Parametri iniziali** — each `initial_research_parameters` entry with value/range/rationale/overfitting risk
   - **Requisiti dati** — `data_requirements`, volume/multi-symbol dependency, expected cost sensitivity
   - **Assunzioni** — `falsifiability.key_assumptions`
   - **Rischi** — `falsifiability.possible_biases` + `cost_sensitivity_risks`
   - **Condizioni di fallimento** — `rejection_conditions`, `needs_more_data_conditions`, `contrary_signals`, `excluded_markets`
   - **Piano di ricerca suggerito** — symbols, providers, timeframes, in-sample/validation/out-of-sample split (deferred to `tradingview-strategy-research/validation-protocol.md` once `config/validation.yaml`'s windows are defined), cost handling, stress tests, benchmark, minimum trade count (citing `config/validation.yaml`'s `minimum_total_trades`, never a fabricated number)
   - **Differenza rispetto alle strategie esistenti** — the `checkOriginality()` verdict plus `differentiation_notes`
   - **Quality gate** — all 10 named gates as sì/no/"no (dati insufficienti)", plus an overall "pronta per research" line
4. **Raccomandazione** — which ideas (if any) are recommended for handoff to `tradingview-strategy-research`, and which were left out and why

## Frontmatter schema

`GenerationReportFrontmatterSchema` in `scripts/schemas/report.ts`:

```yaml
---
date: 2026-07-20T18:00:00Z
registry_strategies_count: 1
ideas_proposed: 2
ideas_discarded: 1
constraints_received: "--count 3 --market forex"
---
```

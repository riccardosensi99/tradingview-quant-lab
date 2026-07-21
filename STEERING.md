# STEERING.md

This is the architectural source of truth for `tradingview-quant-lab`. It describes what is **actually implemented** in this repository today, plus the permanent decisions that shape how it should keep growing. It is not a restatement of any original spec or planning document — those are history; this file is the current state.

For how Claude Code specifically should behave in this repo (commands, MCP session setup, per-skill hard constraints), see [CLAUDE.md](CLAUDE.md). For live-verified MCP tool capabilities, see [MCP_CAPABILITIES.md](MCP_CAPABILITIES.md). This file does not repeat either.

---

## 1. Mission

A quant trading lab that connects to a live TradingView Desktop session (via the `tradingview` MCP server) to do two things well:

1. **Research** — take a trading strategy from a stated hypothesis through backtesting and robustness testing to a defensible `validated` / `rejected` / `needs_more_data` verdict.
2. **Scan** — screen a symbol universe for candidate setups, but *only* using strategies that have actually earned `validated` status.

The system is built to say "no trade" or "not yet validated" as a first-class, expected outcome — not a failure mode to work around.

## 2. Obiettivi

- Never propose a setup backed by a strategy that isn't `status: validated`.
- Never fabricate data — a price, a backtest metric, an MCP field name, a missing trade. Absence is reported as absence (`N/D`, `needs_more_data`, a thrown error), never guessed.
- Every score, exclusion, and classification must be deterministic and show its own working (value, threshold, rationale).
- Domain logic (scoring, risk, regime, validation) stays fully decoupled from live MCP calls, so it's testable without a TradingView session.
- Prefer an explicit failure (typed error, `needs_more_data`, exclusion with reason) over a silent fallback or a plausible-looking default.

## 3. Architettura generale

Data flows in one direction, through one boundary:

```
TradingView Desktop (live)
  → tradingview MCP server (sibling repo, CDP bridge)
  → calling agent (Claude Code, following a SKILL.md's process + hard constraints)
  → scripts/adapter/ (MarketDataAdapter — validates, audit-logs, enforces capability guards)
  → pure domain modules (regime/, scoring/, risk/, validation/, research/)
  → scripts/scanner/ (orchestration: selection, correlation, aggregate risk, ranking, NO TRADE)
  → reports/ (Markdown + JSON) and strategies/registry.yaml
```

**The single load-bearing architectural rule: only the calling agent invokes MCP tools.** No module under `scripts/` calls `mcp__tradingview__*` directly — it's not wired to. Everything under `scripts/` operates on data that's already been fetched and validated (live, via `MarketDataAdapter`, or fixture data in tests). This is why the whole domain layer (regime classification, scoring, risk math, validation classification, scanner ranking) has a full unit test suite with zero dependency on a live TradingView session: 140 tests, 30 files, none of them touch the network.

The MCP boundary itself is `scripts/adapter/market-data-adapter.ts`: every method wraps one MCP tool, validates the response (against a verified schema where one exists, structurally otherwise — see §9), records it to a `ToolAuditLog`, and converts a raw failure into a typed `McpToolError`. Nothing downstream ever sees an unvalidated MCP payload.

## 4. Struttura della repository

Reflects what's actually on disk, not the original scaffold:

```
tradingview-quant-lab/
├── CLAUDE.md                  # Claude Code behavior in this repo
├── STEERING.md                # this file — architectural source of truth
├── MCP_CAPABILITIES.md        # live-verified MCP tool inventory/limits
├── README.md
├── .mcp.json                  # tradingview MCP server registration
├── package.json / package-lock.json / tsconfig.json / vitest.config.ts
│
├── .claude/skills/
│   ├── tradingview-market-scanner/       # SKILL.md + scoring.md, risk-management.md,
│   │                                      # output-template.md (still TODO placeholders —
│   │                                      # the real logic lives in scripts/, not these docs)
│   ├── tradingview-strategy-research/    # SKILL.md + validation-protocol.md, walk-forward.md,
│   │                                      # monte-carlo.md (same caveat)
│   ├── tradingview-strategy-generator/   # SKILL.md + generation-protocol.md, hypothesis-template.md,
│   │                                      # quality-gates.md, output-template.md, registry-integration.md —
│   │                                      # generates falsifiable hypotheses, no MCP calls at all (§6, ADR 0003)
│   └── tradingview-lab/                  # SKILL.md + orchestration-rules.md, state-machine.md,
│                                          # mcp-startup.md, approval-gates.md, output-template.md —
│                                          # single entry point; delegates to the three skills above,
│                                          # never duplicates their logic (§5, ADR 0004)
│
├── config/
│   ├── scanner.yaml    # watchlist/timeframes/max_results/min_score/mode/filters/reporting/regime
│   ├── risk.yaml        # per-trade & aggregate risk limits, hard-forbidden sizing behaviors
│   └── validation.yaml  # validation stage requirements and pass/fail thresholds
│
├── strategies/
│   ├── registry.yaml    # single source of truth for strategy status/stage/metrics/results
│   ├── pine/             # local copies of Pine source (empty — source of truth is TradingView's editor)
│   ├── experimental/     # physical folders exist for 3 of the 7 registry status values —
│   ├── validated/        # see §6 for why the mapping isn't 1:1
│   └── rejected/
│
├── scripts/                       # all TypeScript logic — Node/strict, no MCP calls
│   ├── adapter/    # the MCP boundary (§3): audit.ts, capabilities.ts, errors.ts,
│   │                #   market-data-adapter.ts, types.ts
│   ├── lib/         # generic helpers: load-yaml.ts, frontmatter.ts
│   ├── schemas/     # Zod schemas: registry.ts, config.ts, report.ts
│   ├── research/    # Milestone 2: registry-io.ts, normalize-strategy-results.ts,
│   │                #   basic-checks.ts, backtest-report.ts
│   ├── validation/  # Milestone 3: derived-metrics.ts, monte-carlo.ts, walk-forward.ts,
│   │                #   parameter-stability.ts, cost-sensitivity.ts, long-short.ts,
│   │                #   classify.ts (the classifier), validation-report.ts
│   ├── generation/  # tradingview-strategy-generator: registry-analysis.ts, originality-check.ts,
│   │                #   quality-gates.ts, idea-report.ts, registry-entry-from-idea.ts — zero MCP,
│   │                #   zero disk access except the one explicit write step (ADR 0003)
│   ├── regime/      # Milestone 5: classify-regime.ts, from-config.ts, types.ts
│   ├── scoring/     # Milestone 6: scoring-engine.ts, regime-component.ts, mtf-component.ts
│   ├── risk/        # Milestone 6: position-sizing.ts, aggregate-risk.ts, correlation-filter.ts
│   ├── scanner/     # Milestone 7: select-strategies.ts, run-scan.ts, assemble-scan-input.ts,
│   │                 #   report-markdown.ts, report-json.ts, types.ts
│   ├── mcp/         # tradingview-lab: read-mcp-config.ts, process-status.ts, start-server.ts,
│   │                 #   health-check.ts, startup-manager.ts — zero MCP calls (ADR 0001, ADR 0004);
│   │                 #   interprets an already-obtained tv_health_check result, never calls it
│   ├── orchestrator/ # tradingview-lab: types.ts, inspect-state.ts, choose-workflow.ts,
│   │                 #   plan-lab-run.ts, audit.ts — delegates to generation/research/scanner
│   │                 #   skills, never re-implements their logic (ADR 0004)
│   └── signals/      # SignalPublisher interface + NoopSignalPublisher — the only implementation
│                      #   shipped so far; real channels (Telegram/Discord/email/webhook) are
│                      #   deliberately not implemented yet (§20)
│
├── tests/            # one file per module above, plus fixtures
│                      #   (test-paths.ts, scanner-fixtures.ts, hypothesis-fixtures.ts,
│                      #   orchestrator-fixtures.ts)
│
├── reports/
│   ├── scans/         # generated, gitignored except .gitkeep — Markdown + JSON per scan
│   ├── backtests/     # generated, gitignored except .gitkeep (one real example is untracked
│   │                   #   on disk: sr-volume-zones_2026-07-20.md, referenced by the registry)
│   ├── validations/   # generated, gitignored except .gitkeep
│   ├── ideas/         # generated, gitignored except .gitkeep — tradingview-strategy-generator's output
│   └── lab-runs/      # generated, gitignored except .gitkeep — tradingview-lab's audit.jsonl
│
├── research/          # freeform notes/analysis that doesn't fit structured skill output
└── docs/decisions/    # ADRs — see §21
```

## 5. Responsabilità dei moduli

| Module | Responsibility | Calls MCP? | Depends on |
|---|---|---|---|
| `scripts/adapter/` | The only MCP boundary. Validates raw payloads, enforces capability limits (§9), audit-logs every call. | Receives raw results via an injected `RawToolCaller` — never dials out itself | `scripts/schemas/` (types) |
| `scripts/lib/` | Generic YAML/frontmatter loading with explicit, typed errors. No domain knowledge. | No | — |
| `scripts/schemas/` | Zod schemas + inferred types for the registry, the three config files, and report frontmatter. The single source of truth for what a valid object of each kind looks like. | No | — |
| `scripts/research/` | Registry read/write, raw-strategy-results normalization, basic sanity checks, backtest report rendering. | No | `schemas/`, `adapter/types` |
| `scripts/validation/` | The validation engine: derived metrics, Monte Carlo/walk-forward/parameter-stability analysis over **real** inputs only, cost-sensitivity and long/short-balance checks, and `classify.ts` — the classifier that turns evidence + `config/validation.yaml` into a status verdict. | No | `schemas/` |
| `scripts/regime/` | Deterministic market regime classification from named metrics + configurable thresholds. | No | `schemas/config` (regime thresholds) |
| `scripts/scoring/` | The 9-component score aggregator and two concrete component scorers (regime, multi-timeframe alignment). | No | `regime/`, `schemas/` |
| `scripts/risk/` | Risk/reward and position-size math, aggregate-risk capping, FX-exposure correlation filtering. | No | — |
| `scripts/scanner/` | Orchestration: strategy selection (validated-only), gating, correlation + risk filtering, ranking, NO TRADE, Markdown/JSON report rendering, `assembleScanInput` (the one place real MCP-read data is shaped into the pipeline's input type). | No | everything above |
| `scripts/generation/` | Idea generation for `tradingview-strategy-generator`: registry gap analysis, originality check against existing entries, quality gates, generation-report rendering, and mapping an approved hypothesis to a new registry entry. | No — this skill never calls MCP at all, not even indirectly via the adapter | `schemas/` (incl. `schemas/hypothesis.ts`), `scripts/regime/types.ts` (regime taxonomy reuse), `research/registry-io` (write step only) |
| `scripts/mcp/` | `tradingview-lab`'s MCP boundary: reads/validates `.mcp.json`, informational OS-process detection, a guarded manual `startServer()` (opt-in, never automatic for this repo's stdio transport), and `interpretHealthCheck()` — a pure interpreter of an already-obtained `tv_health_check` payload. Composed by `startup-manager.ts` into 8 states (ADR 0004). | No — never calls `tv_health_check` itself, only interprets a result the calling agent already obtained | `zod` only |
| `scripts/orchestrator/` | `tradingview-lab`'s decision engine: `inspectRegistryState`/`assessNeedsMoreData` (state facts), `chooseWorkflow` (deterministic priority state machine, resolves to at most one workflow), `planLabRun`/`formatLabStatus` (composes everything + the status block), `audit.ts` (structured per-run log). Delegates to the three existing skills — never re-implements gap analysis, scoring, or validation classification (ADR 0004). | No | `schemas/`, `research/registry-io`, `mcp/` |
| `scripts/signals/` | `SignalPublisher` interface + `NoopSignalPublisher`, the only implementation shipped so far — future delivery channels (Telegram/Discord/email/webhook) can be added without touching `scripts/scanner/` (§20). | No | `scanner/types` |

## 6. Lifecycle delle strategie

`strategies/registry.yaml`'s `status` field is the single source of truth, with 7 values: `experimental`, `validation_pending`, `validated`, `disabled`, `rejected`, `needs_more_data`, `validation_failed`. `stage` tracks progress independently: `idea → backtest → walk_forward → monte_carlo → paper → live`. `tradingview-strategy-generator` is the sole producer of `stage: idea` entries (ADR 0003) — every other stage still requires `pine_script_id` and `metrics` to be present, enforced by a `superRefine` on `StrategyRegistryEntrySchema`.

**Deliberate asymmetry**: only 3 of the 7 status values have a corresponding physical folder under `strategies/` (`experimental/`, `validated/`, `rejected/`). `validation_pending`, `disabled`, `needs_more_data`, and `validation_failed` exist only as registry values — there was never a requirement (or a real use case yet) to physically relocate a strategy's files for those states, and Pine source itself lives in TradingView's own editor, not as a committed `.pine` file (`strategies/pine/` is for optional local snapshots, not the source of truth).

Only `classifyStrategy()` in `scripts/validation/classify.ts` may reasonably be said to "decide" a status transition, and it never fabricates a verdict:
- Missing required evidence (out-of-sample results, walk-forward, Monte Carlo, or parameter-stability, whichever `config/validation.yaml` marks `require_*: true`) → `needs_more_data`, unconditionally.
- Repainting or look-ahead bias detected during code review → `rejected`, unconditionally, regardless of how good the metrics look.
- All required criteria present and passing → `validated`.
- All required criteria present, one or more failing → `validation_failed`.

## 7. Workflow Generation → Research → Validation → Registry → Scanner

0. **Generation** (`scripts/generation/`, `tradingview-strategy-generator`): a registry gap analysis (`registry-analysis.ts`) informs one or more falsifiable hypotheses, each checked for originality against the existing registry (`originality-check.ts`) and run through 10 quality gates (`quality-gates.ts`). Surviving ideas are rendered to a report (`idea-report.ts`) under `reports/ideas/` and — only after explicit human approval — written to `strategies/registry.yaml` at `status: experimental`, `stage: idea`, with no Pine code and no backtest metrics (`registry-entry-from-idea.ts`). No MCP call happens anywhere in this stage.
1. **Research** (`scripts/research/`): a strategy's raw `data_get_strategy_results` read is normalized (`normalize-strategy-results.ts`, mapping only the 7 field names actually verified in `MCP_CAPABILITIES.md`), sanity-checked (`basic-checks.ts`), and written up as a backtest report (`backtest-report.ts`) under `reports/backtests/`.
2. **Validation** (`scripts/validation/`): the accumulated evidence (out-of-sample results, walk-forward summary, Monte Carlo distribution, parameter-stability read, cost-sensitivity comparison, long/short balance) is run through `classify.ts` against `config/validation.yaml`'s thresholds, producing a status verdict + a criterion-by-criterion rationale, rendered via `validation-report.ts` to `reports/validations/`.
3. **Registry** (`scripts/research/registry-io.ts`): the verdict updates `strategies/registry.yaml` in the same pass as the report that justifies it — `stage`, `status`, `metrics`/`results`, and the new report path move together, never independently.
4. **Scanner** (`scripts/scanner/`): `select-strategies.ts` filters the registry to `status: validated` entries compatible with the current symbol/timeframe/regime/direction. Only those may back a candidate setup. `run-scan.ts` gates, filters, ranks, and — if the registry has zero validated strategies, or nothing survives filtering — returns NO TRADE by design, not as a fallback.

## 8. Regole MCP

- Only the calling agent (following a SKILL.md's documented process) invokes `mcp__tradingview__*` tools. No file under `scripts/` does.
- `MCP_CAPABILITIES.md` is the sole authoritative source for tool categorization (read-only / mutating / dangerous) and known gaps — it is not restated here, to avoid a second copy that can silently drift after a `tv_update`.
- `scripts/adapter/types.ts` asserts field-level shape only for the two tools with actually-verified field names (`data_get_strategy_results`: 7 of ~19 fields; `data_get_trades`: id/type/side/price/qty/time_index) — both via `.catchall(z.unknown())`, so real-but-unverified fields pass through without the code claiming to know their names. Every other tool (`watchlist_get`, `symbol_info`, `chart_get_state`, `data_get_ohlcv`, `data_get_study_values`) gets structural-only validation (object/array), deliberately, because no field-level shape has ever been captured for them.
- Every `MarketDataAdapter` call is recorded to a `ToolAuditLog` (`{tool, args, timestamp, ok, error}`), which flows into `ScanInput.auditLog` and is rendered in a scan report's "Audit log" section.

## 9. Safety boundaries

Hard constraints (full rationale in each `SKILL.md`, not duplicated here):
- Never call `ui_evaluate`, the `ui_*` automation tools, `replay_trade`, `tv_launch`, or `tv_update` as part of normal operation.
- Never call `pine_set_source`/`pine_save`/`pine_new`/`pine_open` without explicit per-call user confirmation.
- Never call `chart_manage_indicator`/`indicator_add`/`indicator_toggle_visibility`/`indicator_set_inputs`, `watchlist_add`/`watchlist_remove`, `alert_create`/`alert_delete`, or `layout_new`/`layout_switch` without explicit confirmation for that specific change.
- `data_get_strategy_results`/`data_get_trades` documented side effect (auto-open Strategy Tester, auto-unhide a hidden strategy) requires confirmation before the first call on an unfamiliar strategy in a session.
- Any chart symbol/timeframe change must be restored before the skill finishes.

These are **enforced in code**, not just documented, where the adapter can enforce them:
- `getOhlcvSummary()` throws `MissingCapabilityError` *before* calling the tool if `bars > MAX_OHLCV_BARS_PER_CALL` (500) — the cap is checked client-side, not discovered from a failed call.
- `getEquityCurve()` always throws `MissingCapabilityError` — `data_get_equity` is verified to expose no per-bar data; the adapter refuses to return a misleading empty/synthetic curve.
- `data_get_trades`'s `max_trades` parameter is passed through but never trusted to actually cap the response (verified unreliable) — callers must check the real length of what comes back.

## 10. Principi quantitativi

- A hypothesis, target market/timeframe/regime, entry/exit/invalidation, and expected costs are defined *before* a backtest — this is a process discipline the research skill follows, not something the type system can enforce.
- No look-ahead bias, no repainting: `config/validation.yaml`'s `reject_repainting` and `reject_lookahead_bias` are pinned `z.literal(true)` in the schema — a config edit that tries to disable them fails validation outright. `classify.ts` treats either as an unconditional `rejected`, overriding any metric.
- Robustness modules (`monte-carlo.ts`, `walk-forward.ts`, `parameter-stability.ts`) operate exclusively on real, already-collected inputs and throw on an empty input — they resample or aggregate real trades/windows/grid points, they never generate a plausible-looking one.
- Missing required evidence produces `needs_more_data`, never an interpolated or assumed value (§6).
- No single trade, symbol, year, or direction should be allowed to explain a disproportionate share of a strategy's profit — `scripts/validation/long-short.ts` implements this check for direction balance today; per-symbol/per-year concentration checks are not yet implemented (see §20).

## 11. Regole di scoring

- Exactly 9 fixed components summing to 100: `regime` (15), `multi_timeframe` (15), `level` (15), `setup_confirmation` (15), `volatility_liquidity` (10), `volume` (10), `risk_reward` (10), `space` (5), `session` (5) — enforced both by `computeScore()` (throws if any component is missing, duplicated, or exceeds its own cap) and by a dedicated test asserting the caps sum to exactly 100.
- Tiers are fixed: `>=90` exceptional, `>=80` strong, `>=75` valid, below that `below_75`.
- Whether a `below_75`-or-higher setup is actually *shown* is gated separately by `config/scanner.yaml`'s configurable `min_score` (default 75) — the tier label and the show/hide gate are deliberately two different thresholds.
- A hard `ExclusionFlags` entry (unvalidated strategy, unsupported provider/timeframe/regime, stale data, unconfirmed trigger, correlation loss, insufficient R:R, insufficient data) excludes a candidate regardless of its numeric score.
- The score is never adjusted to manufacture a shown result — `computeScore()` only aggregates values the caller already computed and justified; `runScan()` never overrides an exclusion.

## 12. Regole di risk management

Defaults live in `config/risk.yaml`, not in code or docs:
- `risk_per_trade_percent`: 0.5
- `max_total_risk_percent`: 1.5
- `minimum_risk_reward`: 1.8
- `maximum_open_setups`: 3
- `allow_martingale`, `allow_averaging_down`, `allow_recovery_sizing`: hard-pinned `z.literal(false)` in `RiskConfigSchema` — not just defaulted false, but *impossible* to set true without the config failing schema validation.

Mechanics:
- `computeRiskReward()` / `computePositionSize()` are pure geometry (`scripts/risk/position-sizing.ts`). Position size and monetary risk are `null` — not a fabricated default — whenever `accountSize` isn't provided, per "non calcolare la size reale se non specificato".
- `selectWithinAggregateRisk()` greedily fills from highest score down, excluding (with a stated reason) whatever would breach `max_total_risk_percent` or `maximum_open_setups` — it never shrinks a position to fit.
- `filterCorrelatedSetups()` auto-derives exposure only for unambiguous 6-letter FX tickers (base/quote currency, sign from direction). Anything else requires the caller to supply explicit `exposureTags`; without them, a non-FX symbol is only considered correlated with an exact repeat of itself — correlation is never guessed for instruments this codebase has no data to reason about.

## 13. Regole anti-allucinazione

- Reports render `N/D` for a field with no data, never a plausible-looking placeholder (`scripts/scanner/report-markdown.ts`).
- MCP payload schemas assert only verified field names and pass the rest through via `.catchall()` rather than inventing a full shape (§8).
- `scripts/lib/load-yaml.ts` / `frontmatter.ts` throw a descriptive `YamlValidationError` on any parse or schema failure — there is no silent default path.
- Typed errors (`McpToolError`, `MissingCapabilityError`, `YamlValidationError`) carry the real cause; nothing is swallowed.
- A strategy is never marked `validated` on partial evidence — see `classify.ts`'s `needs_more_data` path (§6).

## 14. Convenzioni TypeScript

- `strict: true`, `module`/`moduleResolution: NodeNext`, target `ES2022` (`tsconfig.json`) — relative imports use explicit `.js` extensions (NodeNext requirement even though the source files are `.ts`).
- No `any`. Zod is the only runtime-validation layer; TypeScript types are inferred from Zod schemas (`z.infer<...>`) wherever a schema exists, not hand-duplicated.
- Small, single-responsibility modules — one concern per file (e.g. `derived-metrics.ts` only computes expectancy/payoff/recovery-factor; `monte-carlo.ts` only resamples trade order).
- Prefer pure functions returning a typed result object over side-effecting calls; the few stateful pieces (`ToolAuditLog`, `MarketDataAdapter`) are narrowly scoped classes with an obvious single responsibility.
- Errors are thrown as typed `Error` subclasses with an actionable message, never returned as `null`/`undefined` sentinels that could be mistaken for a valid empty result.

## 15. Convenzioni YAML

- `snake_case` keys throughout `config/*.yaml` and `strategies/registry.yaml`.
- Numeric thresholds and defaults live in `config/*.yaml`, never hardcoded in `.ts` or `.md` — the three config files are the single source of truth (`scanner.yaml`, `risk.yaml`, `validation.yaml`); `filters:`, `reporting:`, and `regime:` are nested inside `scanner.yaml` rather than spawning new top-level config files.
- `strategies/registry.yaml`'s schema is extended additively: every new field introduced beyond the original minimal shape is optional, so existing entries keep validating without anyone backfilling invented data into them.
- `registry-io.ts` preserves the registry file's header comment block on every write (a fixed constant, not regenerated from the data).

## 16. Convenzioni dei report

- Frontmatter is schema-validated where a shape has been fixed: `BacktestReportFrontmatterSchema`, `ScanReportFrontmatterSchema` (`scripts/schemas/report.ts`). The validation report's frontmatter is intentionally *not* schema-pinned yet — `validation-protocol.md` hasn't fixed its exact required fields (see the doc/code gap noted at the top of this file).
- Report bodies render only the fields actually present on their input — an absent metric is omitted from a table (backtest reports) or shown as `N/D` (scan reports), never fabricated to fill a row.
- `reports/scans/`, `reports/backtests/`, `reports/validations/` are generated, reproducible artifacts — gitignored except `.gitkeep`. They are not a source of truth; `strategies/registry.yaml` is.
- The JSON scan report (`report-json.ts`) is a leaner projection of the scan result (selected/discarded setups, exclusions, audit tool names) — not a dump of the full internal `ScanResult` object (which also carries the entire registry/config for convenience during orchestration).

## 17. Logging e Audit

`scripts/adapter/audit.ts`'s `ToolAuditLog` is the single audit mechanism: every `MarketDataAdapter` call appends `{tool, args, timestamp, ok, error}` regardless of success or failure. `toolsUsed()` and `failures()` are the two derived views actually consumed downstream — the scan report's "Audit log" table and the JSON report's `mcpToolsUsed` field both read directly from this log, not from a separately maintained list.

## 18. Decisioni architetturali permanenti

1. MCP tool calls originate only from the calling agent; `scripts/` code never calls them directly (§3, §8).
2. `filters:`, `reporting:`, and `regime:` config live nested inside `config/scanner.yaml` rather than as new top-level config files — the config file count stays at 3.
3. `npm` is the package manager (matches CLAUDE.md's documented commands; `pnpm` isn't installed on the reference machine).
4. `strategies/registry.yaml`'s schema is extended additively — new fields are always optional; the original `metrics` block is kept for backward compatibility alongside the richer `results.*` shape rather than being migrated/removed.
5. Hard-forbidden risk behaviors (martingale, averaging down, recovery sizing) and hard-required validation rejections (repainting, look-ahead bias) are pinned at the Zod schema level (`z.literal`), not left as documentation the code merely happens to respect.
6. Scoring component caps (15/15/15/15/10/10/10/5/5 = 100) are fixed and enforced by a dedicated test, not adjustable per run.
7. A candidate's numeric score and its `excluded` flag are separate, independently-computed gates — a hard exclusion never gets "absorbed" into a lower score.
8. Correlation is auto-derived only for unambiguous 6-letter FX tickers; every other instrument requires an explicit, caller-supplied exposure tag.
9. Validation classification defaults to `needs_more_data` on any missing required evidence — it never interpolates or assumes.
10. Reports are reproducible generated artifacts (gitignored except `.gitkeep`); only their frontmatter shape is schema-validated, not their full content.
11. `StrategyRegistryEntrySchema` requires `pine_script_id`/`metrics` for every stage except `idea`, enforced via `superRefine`, not a blanket-optional relaxation — the schema still guarantees no non-idea entry lacks evidence (ADR 0003).
12. `tradingview-lab`'s orchestrator delegates to the three existing skills and never re-implements their gap-analysis/scoring/validation logic; its own `scripts/orchestrator/` and `scripts/mcp/` modules only inspect state and decide, following the same MCP boundary as every other module (ADR 0004).
13. MCP server readiness is judged solely by whether `mcp__tradingview__*` tools respond in the current session (`toolsAvailableInSession`), never by OS-level process scanning — `ps` cannot distinguish this session's own stdio-spawned server from an orphan left by a prior restart (verified live: 3 such orphans existed at design time). A manual server start is never automatic; it requires explicit per-run user confirmation (ADR 0004).

## 19. Definition of Done

**For a code change to a module:**
- `npm run typecheck`, `npm run build`, and `npm test` all pass.
- No new path fabricates data — missing input renders `N/D`, throws a typed error, or produces `needs_more_data`, per which pattern the surrounding module already uses.
- Any new numeric threshold or default lives in the relevant `config/*.yaml`, with a matching Zod schema field in `scripts/schemas/config.ts` — never hardcoded in a `.ts` or `.md` file.
- Any new hard safety/risk rule is enforced at the schema/type level (`z.literal`, a thrown guard) wherever that's possible, not left as prose alone.
- New logic gets a dedicated test file under `tests/`, mirroring the module's path.

**For a strategy to be promoted to `status: validated`:**
- Every criterion `classify.ts` evaluates against `config/validation.yaml` for that strategy passes — no exceptions carved out for a strategy the researcher believes in.
- Every `require_*` flag currently `true` in `config/validation.yaml` has corresponding real evidence in the registry entry (no missing walk-forward/Monte Carlo/parameter-stability data papered over).
- The registry update (`status`, `stage`, `results`, report path, `last_updated`) lands in the same change as the report that justifies it.

## 20. Future extension guidelines

- A new score component or regime signal is a new pure function with its own test file — follow the pattern in `scripts/scoring/regime-component.ts` or `scripts/regime/classify-regime.ts`, don't inline scoring logic into the orchestrator.
- Any new use of an MCP tool is added as a method on `MarketDataAdapter`, never called ad hoc elsewhere in `scripts/` — this keeps the audit log and capability guards complete by construction.
- A new configurable threshold gets a field in the appropriate `config/*.yaml` plus a corresponding Zod schema field with a sensible `.default()` — check whether it belongs in an existing nested block (`filters`, `reporting`, `regime`) before adding a new top-level key.
- Before assuming an MCP tool exposes a given field or capability, check `MCP_CAPABILITIES.md` for a live-verified confirmation. If it's not there, the field-level schema should stay unverified (structural-only or `.catchall()`), per §8 — don't upgrade a schema's strictness on an assumption.
- Known gaps not yet implemented, called out honestly rather than silently: per-symbol and per-year profit-concentration checks (only direction-balance exists today, §10); a schema-validated validation-report frontmatter (§16); automatic derivation of regime input metrics from raw OHLCV (today they must already be computed and visible on the chart, since the skills never add indicators).

## 21. ADR (Architecture Decision Records)

Going forward, a decision significant enough to constrain future work — and not fully captured by an addition to §18 above — gets its own ADR under [`docs/decisions/`](docs/decisions/). See that folder's `README.md` for the format and the seed ADRs already recorded there.

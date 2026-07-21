# Orchestration rules

## Invocation

`/tradingview-lab` with no arguments runs with every default below. Flags are parsed "as prose" by the agent from the invocation text — there is no CLI parser, same convention as `tradingview-strategy-generator`.

| Flag | Default | Meaning |
|---|---|---|
| `--goal` | `auto` | `auto \| generate \| research \| validate \| scan \| review \| status \| docs` |
| `--mode` | `normal` | `quick \| normal \| strict` — see Preflight modes below |
| `--start-mcp` | `true` | Whether a manual MCP start may even be offered as an option when needed — never bypasses the confirmation rule in [mcp-startup.md](mcp-startup.md) |
| `--workflow` | `auto` | `auto \| strategy-generator \| strategy-research \| strategy-validation \| market-scanner \| registry-review \| documentation-sync` |
| `--strategy-id` | unset | Target a specific registry entry |
| `--market` | unset | Passed through to `tradingview-strategy-generator`'s own `--market` |
| `--scan` | unset | Shorthand for `--goal scan` |
| `--generate-count` | `3` | Passed through to `tradingview-strategy-generator`'s own `--count` |
| `--max-actions` | `1` | How many workflows this run may select — `chooseWorkflow()` only ever returns one regardless (§18: no automatic chaining in this version) |
| `--dry-run` | `true` | When true, stop after showing the plan (step 5/6 in SKILL.md) without delegating |
| `--require-approval` | `true` | Governs approval for non-registry-mutating workflows (`market-scanner`, `registry-review`, `documentation-sync`); `strategy-generator`/`strategy-research`/`strategy-validation` always require approval regardless of this flag — see [approval-gates.md](approval-gates.md) |

`--goal scan` (or `--scan true`) bypasses the research-priority order and runs the scanner directly, provided at least one `status: validated` strategy exists — it does not first trigger months of research. If no validated strategy exists, the result is `NO_ACTION`, not a scan that would only ever produce NO TRADE.

## Preflight modes

- **quick** — configs load + schema-valid, registry loads + schema-valid, MCP state evaluation, TradingView health check (if MCP is ready).
- **normal** (default) — quick, plus: git status, latest report dates, targeted state inspection (`inspectRegistryState`, `assessNeedsMoreData`).
- **strict** — normal, plus: `npm run typecheck`, `npm test`, `npm run build` (run live via Bash — these are ordinary dev-tool invocations, not MCP calls, and are not wrapped in `scripts/` per [STEERING.md §14](../../../STEERING.md#14-convenzioni-typescript)'s "small, single-responsibility, pure functions" convention; wrapping a shell-out inside the pure orchestrator modules would blur that boundary for no benefit).

None of the three modes ever run the full scanner or a live backtest as part of preflight — preflight only ever reads and checks, consistent with [approval-gates.md](approval-gates.md)'s no-approval-needed list.

## Priority order (goal=auto, workflow=auto)

See [state-machine.md](state-machine.md) for the full decision engine (`scripts/orchestrator/choose-workflow.ts`). Summary, highest first:

1. System errors (invalid config/registry) → `status`, stop.
2. `validation_pending` strategies (research already started).
3. `needs_more_data` strategies that are now resumable (see below).
4. `experimental` strategies with approved Pine code that were never backtested.
5. New idea generation, if none of the above applies and zero `validated` strategies exist.
6. Market scan, once at least one `validated` strategy exists.

A `needs_more_data` strategy is **resumable** only when every currently-missing required criterion (`config/validation.yaml`'s `require_*` flags) is blocked purely by "hasn't been run yet," not by a still-`null` config value (`walk_forward.*`, `monte_carlo.simulations`) or by an actual data shortfall (`total_trades` below `minimum_total_trades` — needs more live trades, not a rerun). `scripts/orchestrator/inspect-state.ts`'s `assessNeedsMoreData()` computes this per strategy and shows its reasoning (`hardBlocks` vs. `resumableGaps`), never guesses. As of this writing, this repo's one real entry (`sr-volume-zones`) is blocked, not resumable — `config/validation.yaml`'s `walk_forward`/`monte_carlo` windows are still `null`.

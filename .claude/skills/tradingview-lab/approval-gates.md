# Approval gates

Restates [STEERING.md §8-9](../../../STEERING.md#8-regole-mcp) and each delegated skill's own hard constraints in one place for this orchestrator's own actions — it does not relax or replace any of them.

## Requires explicit approval before proceeding

- Adding a strategy to `strategies/registry.yaml` (delegated to `tradingview-strategy-generator`'s own step 6 hard stop).
- Creating or modifying a Pine script (`pine_set_source`/`pine_save`/`pine_new`/`pine_open` — delegated to `tradingview-strategy-research`, never called by this skill directly).
- Starting a new, costly research cycle (walk-forward, Monte Carlo, a fresh out-of-sample pass).
- Changing validation parameters (`config/validation.yaml`) or `strategies/registry.yaml`'s `status`/`stage`.
- Any mutating MCP tool call (`watchlist_add`/`watchlist_remove`, `alert_create`/`alert_delete`, `layout_new`/`layout_switch`, `chart_manage_indicator`/`indicator_*`).
- Starting a process with a command not already documented in `.mcp.json` (see [mcp-startup.md](mcp-startup.md) — a manual `startServer()` call always requires this).
- Editing `.mcp.json`.
- Installing a dependency.

`strategy-generator`, `strategy-research`, and `strategy-validation` workflows always require approval from this orchestrator's own gate too (`WORKFLOWS_ALWAYS_REQUIRING_APPROVAL` in `scripts/orchestrator/choose-workflow.ts`), independent of `--require-approval` — that flag only governs the lighter-weight `market-scanner`/`registry-review`/`documentation-sync` workflows.

## Does not require a new approval

- Any read-only call (`tv_health_check`, `chart_get_state`, `watchlist_get`, `data_get_ohlcv`, etc.).
- Reading `strategies/registry.yaml` or any file under `reports/`.
- A dry-run scan that was already authorized for this run (`--dry-run true`, the default).
- Producing the plan/status block itself.
- Writing a local report under `reports/lab-runs/` (the audit log) or the plan text shown to the user — not a registry or Pine mutation.

## This skill never does, under any circumstance

Same absolute list as [STEERING.md §9](../../../STEERING.md#9-safety-boundaries) and every sibling skill: no real order, no broker integration, no auto-trading, no martingale/averaging-down/recovery sizing (hard-pinned at the schema level regardless), no `ui_evaluate`, no silent chart mutation, no undocumented MCP capability, no fabricated data, no invented shell command, no `sudo`, no indiscriminate process kill, no intentional duplicate MCP server process.

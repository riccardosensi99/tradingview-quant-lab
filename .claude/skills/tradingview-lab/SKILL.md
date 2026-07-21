---
name: tradingview-lab
description: Use as the single entry point for the quant lab — e.g. "avvia il lab", "cosa devo fare ora", "controlla lo stato del sistema" — when the user hasn't already named a specific skill. Checks repo/config/registry health, checks (never blindly starts) the tradingview MCP server, reads strategies/registry.yaml, and proposes or runs exactly one of the existing skills (tradingview-strategy-generator, tradingview-strategy-research, tradingview-market-scanner) or a local-only workflow (registry review, documentation sync). Never runs a real order, never duplicates the logic of the skills it delegates to.
---

# TradingView Lab Orchestrator

Coordinates the existing skills — it does not reimplement any of them. Generation logic stays in `tradingview-strategy-generator`, research/validation logic stays in `tradingview-strategy-research`, scanning logic stays in `tradingview-market-scanner`. This skill's own logic (state inspection, MCP startup evaluation, workflow selection, audit logging) lives in `scripts/orchestrator/` and `scripts/mcp/`, follows the same architecture as every other skill in this repo (see [STEERING.md §3](../../../STEERING.md#3-architettura-generale)): **no file under `scripts/` calls an `mcp__tradingview__*` tool** (ADR 0001) — the agent makes any live call and hands the raw result to a pure interpreter.

See [orchestration-rules.md](orchestration-rules.md) for inputs/flags, [state-machine.md](state-machine.md) for the decision engine, [mcp-startup.md](mcp-startup.md) for the MCP boundary (read this before ever considering starting a process), [approval-gates.md](approval-gates.md) for what needs human sign-off, and [output-template.md](output-template.md) for the status/result format.

## Process

1. **Preflight** — per `--mode` (default `normal`, see [orchestration-rules.md](orchestration-rules.md)):
   - Read `.mcp.json`, `strategies/registry.yaml`, `config/{scanner,risk,validation}.yaml`. Any load/schema failure → `status`-only output, stop (`scripts/orchestrator/plan-lab-run.ts`'s `systemErrors`).
   - `normal`/`strict`: also run whatever targeted checks the mode calls for (`strict` adds `npm run typecheck`, `npm test`, `npm run build` — run these live via Bash, do not wrap them in `scripts/`, see [orchestration-rules.md](orchestration-rules.md)).
   - Check `git status` for branch/working-tree state.
2. **MCP check — read [mcp-startup.md](mcp-startup.md) before this step.** Never spawn a process as a first resort:
   - `readMcpConfig(".mcp.json")` (`scripts/mcp/read-mcp-config.ts`).
   - Check whether `mcp__tradingview__*` tools are already usable in this session (they usually are — Claude Code spawns the stdio server automatically at session start). If yes, call `tv_health_check` live and pass the raw result to `interpretHealthCheck()` (`scripts/mcp/health-check.ts`).
   - Compose everything with `evaluateMcpStartup()` (`scripts/mcp/startup-manager.ts`) to get one of the 8 states.
   - Only if the state is `configured` (tools not available) **and** the user explicitly confirms a manual start for this specific run, call `startServer()` (`scripts/mcp/start-server.ts`) — otherwise report the state and tell the user a Claude Code session restart is what actually fixes it.
   - `ps`-detected processes are informational only (`findMatchingProcesses`, `scripts/mcp/process-status.ts`) — never used to decide anything.
3. **Registry + state inspection** — `readRegistry()` (reused from `scripts/research/registry-io.ts`), `inspectRegistryState()` + `assessNeedsMoreData()` (`scripts/orchestrator/inspect-state.ts`). If a live scan is in play, also `watchlist_get` for the symbol count and `chart_get_state` for the current chart — otherwise skip (no MCP calls for goals that don't need them, e.g. `generate`, `status`, `docs`).
4. **Decision** — `chooseWorkflow()` (`scripts/orchestrator/choose-workflow.ts`) against [state-machine.md](state-machine.md)'s priority order. Always resolves to at most one workflow (`max-actions: 1` by construction).
5. **Show the status block** (§ output-template.md) and the decision (READY / ACTION_REQUIRED / BLOCKED / NO ACTION).
6. **Approval gate** — see [approval-gates.md](approval-gates.md). If required and not yet given, stop here and ask.
7. **Delegate** — invoke the chosen skill (`tradingview-strategy-generator`, `tradingview-strategy-research`, or `tradingview-market-scanner`) with a structured context: goal, strategy id, current state, configs read, MCP/TradingView health, reason for the choice, limits, relevant files, approvals already granted. For `registry-review`/`documentation-sync` (no existing skill covers these), do the read-only review or doc-sync directly, still under the same approval rules.
8. **Audit** — `buildAuditRecord()` + `appendAuditLog()` (`scripts/orchestrator/audit.ts`) to `reports/lab-runs/audit.jsonl`.
9. **Stop.** Do not chain into another workflow in the same run (§18 of the original spec — a future controlled batch mode is out of scope for this version).

## Hard constraints

Everything in [STEERING.md §8-9](../../../STEERING.md#8-regole-mcp) applies, plus, specific to this skill:

- Never call `mcp__tradingview__*` tools for goals that don't need them (`generate`, `status`, `docs`, `review`) — same rule `tradingview-strategy-generator` already follows.
- Never call `ui_evaluate`, `pine_set_source` (or any Pine-editor-mutating tool), `alert_create`, `watchlist_add`/`watchlist_remove`, `layout_new`/`layout_switch`, or `tv_launch`/`tv_update` — this skill only ever reads, decides, and delegates; any mutating action happens inside the delegated skill under that skill's own confirmation rules.
- Never spawn a second `tradingview` MCP server process when `mcp__tradingview__*` tools already respond in this session — see [mcp-startup.md](mcp-startup.md) (verified live: orphaned duplicate server processes already exist on this machine from prior session restarts; this skill must not add to that).
- Never execute a real order, never touch a broker, never implement martingale/averaging-down/recovery sizing (already hard-forbidden at the schema level, [STEERING.md §12](../../../STEERING.md#12-regole-di-risk-management)).
- Never send an external notification — `scripts/signals/` ships only `NoopSignalPublisher` in this version.

## Output

- Status block + decision printed to the conversation (format: [output-template.md](output-template.md)).
- `reports/lab-runs/audit.jsonl` — one JSON line appended per run (`scripts/orchestrator/audit.ts`).
- Whatever the delegated skill produces under `reports/` and `strategies/registry.yaml`, per that skill's own `SKILL.md`.

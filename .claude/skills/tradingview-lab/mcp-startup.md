# MCP startup — read this before considering a process spawn

## The transport is stdio, and Claude Code already owns it

`.mcp.json` registers `tradingview` as a `stdio` server: `node /home/king/dev/tradingview-mcp/src/server.js`. **Claude Code spawns this process itself when the session loads `.mcp.json`** — nothing under `scripts/` or this skill does that as part of normal operation. This matches `tradingview-mcp`'s own `SETUP_GUIDE.md`: "The MCP server only loads when Claude Code starts... restart Claude Code."

## Verified live finding (design-time, keep this in mind for every run)

While designing this skill, `ps` showed **three separate `node .../tradingview-mcp/src/server.js` processes already running** on the reference machine, left over from previous Claude Code session restarts — none of them killed automatically, none obviously "owned" by any particular session. At the same time, `mcp__tradingview__*` tools were already working fine in the active session, and TradingView Desktop was healthy (`cdp_connected: true`, port 9222 listening).

This is exactly the failure mode this document exists to prevent: **`ps`-based detection cannot tell "the process wired to this session" apart from an orphan**. Do not use it to decide whether to start anything. Do not kill any of them either — this skill never terminates a process it didn't start itself, and there's no way to know from here whether another session still needs one of those orphans.

## The one reliable signal

Whether `mcp__tradingview__*` tool schemas are actually callable in the current session. In practice: if this skill's SKILL.md process reaches step 2, those tools are either already present (the normal case — check the tool list, or simply try `tv_health_check` and see if it resolves) or they are not, in which case the fix is a **Claude Code session restart**, not a spawn.

`scripts/mcp/startup-manager.ts`'s `evaluateMcpStartup()` encodes exactly this: `toolsAvailableInSession` is the switch between `configured` (needs a restart) and `already_running`/`ready` (tools work, health-check the rest). `matchingProcesses` (from `scripts/mcp/process-status.ts`) rides along in the report purely as an informational count for the status block — it never appears in the decision logic.

## When a manual start is actually appropriate

`scripts/mcp/start-server.ts`'s `startServer()` exists for one narrow case: `mcp__tradingview__*` tools are **not** available in this session (state `configured`), and the user has explicitly confirmed, for this specific run, that a manual spawn should happen anyway (e.g. because they know this session's transport isn't actually stdio-managed the normal way, or they're deliberately testing this module). It refuses to run without `confirmed: true` — there is no default that lets it fire silently.

Do not call it just because health checks are failing while `toolsAvailableInSession` is already `true` — that means a server is already wired to this session and unhealthy for some other reason (TradingView Desktop not running, wrong port), not that a second server would help.

## Read-only diagnostics that are always safe

`node /home/king/dev/tradingview-mcp/src/cli/index.js status` (documented in `MCP_CAPABILITIES.md` and `SETUP_GUIDE.md`) is a one-shot CLI call that connects to the existing CDP session and exits — it does not spawn a persistent process. Safe to use for out-of-session sanity checks; it is not a substitute for the in-session `tv_health_check` tool call, which is what `interpretHealthCheck()` actually expects as input.

# Output Template

Rendered by `scripts/scanner/report-markdown.ts` (Markdown, `renderScanReportMarkdown`) and `scripts/scanner/report-json.ts` (JSON, `toScanReportJson`), from a `ScanResult` produced by `scripts/scanner/run-scan.ts`. Written to `reports/scans/<YYYY-MM-DD>_<HHmm>_scan.{md,json}` (both, per `config/scanner.yaml`'s `reporting.save_markdown`/`save_json`). Tested in `tests/report-markdown.test.ts` and `tests/report-json.test.ts`.

## Structure (Markdown)

1. **Header** — UTC/local timestamp, watchlist source, symbol counts (present/analyzed/excluded), requested/available timeframes, mode, which strategies in the registry are currently `validated`, MCP/TradingView limitations.
2. **Risultato** — either:
   - **NO TRADE**: the reasons (e.g. "no strategy has status=validated", "no candidate met the minimum score"), which validated strategies exist (if any), and near-miss symbols.
   - **Setup selezionati**: one block per selected candidate — score + tier, strategy id/version/status, regime + confidence, timeframe, HTF context, session, provider, data timestamp, entry zone/trigger (and whether the trigger is confirmed), stop/invalidation, targets, R:R to T1/T2, suggested risk %, monetary risk, theoretical size, estimated duration/expiry, quantitative rationale, the full 9-component score breakdown with each component's own rationale, penalties, risks, invalidation conditions, and the fixed "non entrare se" checklist.
3. **Setup scartati rilevanti** — every discarded candidate (failed scoring, unvalidated strategy, correlation loss, aggregate-risk overflow) with its reason.
4. **Esposizione e correlazione** — which setups were excluded for correlation and which were kept instead, aggregate risk used vs. the configured cap, residual risk budget.
5. **Audit log** — every MCP tool call recorded by `ToolAuditLog` during the scan, with timestamp and outcome.
6. **Separazione delle informazioni** — a fixed closing note distinguishing observed data, calculated data, interpretation, and what's marked `N/D`.

**Anti-fabrication rule actually enforced by the renderer**: any field with no data renders the literal string `N/D` — it is never left blank, guessed, or filled with a plausible-looking value. Report bodies (backtest reports too, via `scripts/research/backtest-report.ts`) only render metrics that are actually present on the input object.

## Structure (JSON)

`ScanReportJson` (`report-json.ts`) — a lean projection, not a dump of the full internal `ScanResult` (which also carries the whole registry/config for convenience during orchestration): timestamps, watchlist source, symbol counts, excluded symbols, mode, `validatedStrategies`, `noTrade` + reasons, `selectedSetups`, `discardedSetups`, `correlationExcluded`, `aggregateRiskExcluded`, `totalRiskPct`, `mcpToolsUsed`, `mcpLimitations`, `tradingviewLimitations`.

## Frontmatter schema

Only the scan report's frontmatter fields are formally schema-validated (`ScanReportFrontmatterSchema` in `scripts/schemas/report.ts`), reused by both this skill and its tests:

```yaml
---
date: 2026-07-20T18:30:00
universe_source: watchlist:ric
symbols_scanned: 9
candidates_found: 2
---
```

## Real example

`reports/scans/2026-07-20_1932_scan.md` (generated during the Milestone 8 dry run, gitignored like all scan reports) — a real NO TRADE report against the live "ric" watchlist, correctly explaining that no strategy in `strategies/registry.yaml` has `status: validated` yet.

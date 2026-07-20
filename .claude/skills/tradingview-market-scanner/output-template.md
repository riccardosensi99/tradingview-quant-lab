# Output Template

Scan reports go to `reports/scans/<YYYY-MM-DD>_<HHmm>_scan.md`: YAML frontmatter + a candidates table.

## Frontmatter

```yaml
---
date: 2026-07-20T18:30:00
universe_source: watchlist:ric   # or config/scanner.yaml watchlist
symbols_scanned: 9
candidates_found: 2
---
```

## Fields

TODO: finalize the candidates table columns once [scoring.md](scoring.md) is filled in. Draft:

| Simbolo | Score | Setup | Prezzo | Note |
|---|---|---|---|---|

- `Simbolo`: full `EXCHANGE:TICKER` (as returned by `chart_get_state`/`symbol_info`, not a bare ticker)
- `Prezzo`: from `quote_get` (`last`) at scan time
- `Score`, `Setup`, `Note`: TODO, depend on scoring.md

## Example

TODO: sample output block, once scoring is defined.

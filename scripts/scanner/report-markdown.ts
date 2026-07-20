// Markdown scan report renderer, following the structure fixed by research
// spec section 15. Fields with no data available render "N/D" (non
// disponibile) rather than being fabricated or silently omitted — the point
// of the report is to make gaps visible.

import type { CandidateSetup, ScanResult } from "./types.js";

const ND = "N/D";

function fmt(value: unknown): string {
  if (value === undefined || value === null || value === "") return ND;
  return String(value);
}

function renderSetup(setup: CandidateSetup, index: number): string {
  const s = setup.scoreBreakdown;
  const componentLines = s.components
    .map((c) => `- ${c.name}: ${c.value}/${c.max} — ${c.rationale}`)
    .join("\n");
  const penaltyLines =
    s.penalties.length > 0
      ? s.penalties.map((p) => `- ${p.name}: ${p.points} — ${p.rationale}`).join("\n")
      : "- (nessuna)";

  return `#### ${index}. ${setup.symbol} — ${setup.direction === "long" ? "LONG" : "SHORT"}

Score:
${s.finalScore}/100 (${s.tier})

Strategia:
${fmt(setup.strategyId)}

Versione strategia:
${fmt(setup.strategyVersion)}

Stato strategia:
validated

Regime:
${setup.regime.regime} (confidence ${setup.regime.confidence.toFixed(2)})

Timeframe operativo:
${fmt(setup.timeframeOperativo)}

Contesto 4H/1D:
${fmt(setup.contextHtf)}

Sessione:
${fmt(setup.session)}

Provider:
${fmt(setup.provider)}

Timestamp dei dati:
${fmt(setup.timestampData)}

Entry zone:
${fmt(setup.entryZone)}

Trigger:
${fmt(setup.trigger)} (confermato: ${setup.triggerConfirmed ? "sì" : "no"})

Stop loss:
${fmt(setup.stopLoss)}

Invalidazione:
${fmt(setup.invalidation)}

Target 1:
${fmt(setup.target1)}

Target 2:
${fmt(setup.target2)}

R:R fino a T1:
${fmt(setup.riskRewardT1)}

R:R fino a T2:
${fmt(setup.riskRewardT2)}

Rischio suggerito:
${setup.riskPct}%

Rischio monetario:
${fmt(setup.monetaryRisk)}

Size teorica:
${fmt(setup.theoreticalSize)}

Durata stimata del setup:
${fmt(setup.estimatedDuration)}

Scadenza del setup:
${fmt(setup.expiry)}

Motivazioni quantitative:
${setup.rationale.length > 0 ? setup.rationale.map((r) => `- ${r}`).join("\n") : "- (nessuna)"}

Dettaglio score:
${componentLines}
- penalità:
${penaltyLines}

Rischi:
${setup.risks.length > 0 ? setup.risks.map((r) => `- ${r}`).join("\n") : "- (nessuno registrato)"}

Condizioni che annullano il trade:
${setup.invalidationConditions.length > 0 ? setup.invalidationConditions.map((r) => `- ${r}`).join("\n") : "- (nessuna registrata)"}

Non entrare se:
- il prezzo parte senza retest;
- il trigger non viene confermato;
- il rapporto rischio/rendimento scende sotto il minimo;
- il setup viene invalidato prima dell'ingresso;
- i dati diventano stale;
- il regime cambia;
- viene rilevato un evento non considerato.
`;
}

export function renderScanReportMarkdown(result: ScanResult): string {
  const { input } = result;

  const header = `# TradingView Market Scan

Data e ora UTC:
${input.generatedAtUtc}

Data e ora locale:
${input.generatedAtLocal}

Watchlist:
${input.watchlistSource}

Simboli presenti:
${input.symbolsPresent.length}

Simboli analizzati:
${input.symbolsAnalyzed.length}

Simboli esclusi:
${input.excludedSymbols.length}

Timeframe richiesti:
${input.timeframesRequested.join(", ") || ND}

Timeframe disponibili:
${input.timeframesAvailable.join(", ") || ND}

Modalità:
${input.mode}

Strategie validate disponibili:
${input.registry.strategies.filter((s) => s.status === "validated").map((s) => s.id).join(", ") || "nessuna"}

Qualità generale dei dati:
${input.excludedSymbols.length === 0 ? "nessuna esclusione registrata" : `${input.excludedSymbols.length} simboli esclusi per qualità dati insufficiente`}

Qualità generale del mercato:
${ND}

Limitazioni MCP:
${input.mcpLimitations.length > 0 ? input.mcpLimitations.map((l) => `- ${l}`).join("\n") : "- nessuna registrata"}

Limitazioni TradingView:
${input.tradingviewLimitations.length > 0 ? input.tradingviewLimitations.map((l) => `- ${l}`).join("\n") : "- nessuna registrata"}
`;

  const risultato = result.noTrade
    ? `## Risultato

### NO TRADE

Nessun setup ha superato i criteri minimi.

Motivi principali:
${result.noTradeReasons.map((r) => `- ${r}`).join("\n")}

Strategie validate disponibili:
${input.registry.strategies.filter((s) => s.status === "validated").map((s) => s.id).join(", ") || "nessuna"}

Simboli quasi validi:
${result.discardedSetups.length > 0 ? result.discardedSetups.map((d) => `- ${d.symbol} (${d.direction}): ${d.reason}`).join("\n") : "- nessuno"}
`
    : `## Risultato

### Setup selezionati

${result.selectedSetups.map((s, i) => renderSetup(s, i + 1)).join("\n")}`;

  const discarded = `## Setup scartati rilevanti

${
  result.discardedSetups.length > 0
    ? result.discardedSetups
        .map(
          (d) =>
            `- **${d.symbol}** (${d.direction}${d.strategyId ? `, ${d.strategyId}` : ""}${d.score !== undefined ? `, score ${d.score}` : ""}): ${d.reason}${d.futureCondition ? ` — potrebbe diventare valido se: ${d.futureCondition}` : ""}`,
        )
        .join("\n")
    : "Nessuno."
}
`;

  const exposure = `## Esposizione e correlazione

Setup correlati esclusi:
${
  result.correlationExcluded.length > 0
    ? result.correlationExcluded.map((e) => `- ${e.id}: ${e.reason} (mantenuto: ${e.keptInstead})`).join("\n")
    : "- nessuno"
}

Setup esclusi per rischio aggregato:
${
  result.aggregateRiskExcluded.length > 0
    ? result.aggregateRiskExcluded.map((e) => `- ${e.id}: ${e.reason}`).join("\n")
    : "- nessuno"
}

Rischio aggregato utilizzato:
${result.totalRiskPct}% (massimo configurato: ${input.riskConfig.max_total_risk_percent}%)

Rischio residuo disponibile:
${Math.max(0, input.riskConfig.max_total_risk_percent - result.totalRiskPct)}%
`;

  const audit = `## Audit log

${
  input.auditLog.length > 0
    ? `| Tool | Timestamp | Esito |\n|---|---|---|\n${input.auditLog
        .map((e) => `| ${e.tool} | ${e.timestamp} | ${e.ok ? "ok" : `errore: ${e.error ?? ""}`} |`)
        .join("\n")}`
    : "Nessuna chiamata MCP registrata."
}
`;

  const separation = `## Separazione delle informazioni

- Dati osservati: campi popolati da letture MCP dirette (OHLCV, Strategy Tester, watchlist).
- Dati calcolati: score, R:R, size teorica, rischio aggregato — derivati deterministicamente dai dati osservati.
- Interpretazioni: classificazione di regime e relative motivazioni.
- Dati non disponibili: contrassegnati "${ND}" in questo report.
- Assunzioni: nessuna assunzione silenziosa — ogni esclusione/penalità riporta una motivazione esplicita.
- Limiti: vedi sezioni "Limitazioni MCP" e "Limitazioni TradingView" sopra.
`;

  return [header, risultato, discarded, exposure, audit, separation].join("\n");
}

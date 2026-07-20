// Renders reports/ideas/<date>_generation.md, per
// .claude/skills/tradingview-strategy-generator/output-template.md. Literal
// template style (no templating engine) mirroring
// scripts/research/backtest-report.ts: fixed section order for diff
// stability, only present data rendered, and every quality-gate result
// shown honestly (a `null` gate is rendered as "no (dati insufficienti)",
// never silently treated as a pass — see scripts/generation/quality-gates.ts).

import { GenerationReportFrontmatterSchema } from "../schemas/report.js";
import type { HypothesisIdea } from "../schemas/hypothesis.js";
import type { RegistryGapAnalysis } from "./registry-analysis.js";
import type { OriginalityVerdict } from "./originality-check.js";
import type { QualityGateCheck, QualityGateResult } from "./quality-gates.js";

export interface IdeaReportEntry {
  idea: HypothesisIdea;
  originality: OriginalityVerdict;
  gates: QualityGateResult;
}

export interface DiscardedIdeaEntry extends IdeaReportEntry {
  reason: string;
}

export interface IdeaReportInput {
  date: string;
  registryStrategiesCount: number;
  constraintsReceived: string;
  gapAnalysis: RegistryGapAnalysis;
  discarded: DiscardedIdeaEntry[];
  proposed: IdeaReportEntry[];
  recommendation: string;
}

function sinoNullable(passed: boolean | null): string {
  if (passed === true) return "sì";
  if (passed === false) return "no";
  return "no (dati insufficienti)";
}

function gate(checks: QualityGateCheck[], name: QualityGateCheck["name"]): QualityGateCheck {
  const found = checks.find((c) => c.name === name);
  if (!found) throw new Error(`quality gate "${name}" missing from checks — this is a programming error, not user input`);
  return found;
}

function renderRecord(record: Record<string, number>): string {
  const entries = Object.entries(record);
  if (entries.length === 0) return "_(nessun dato)_";
  return entries.map(([key, count]) => `- ${key}: ${count}`).join("\n");
}

function renderList(items: string[], emptyLabel: string): string {
  if (items.length === 0) return `_(${emptyLabel})_`;
  return items.map((item) => `- ${item}`).join("\n");
}

function originalityLabel(originality: OriginalityVerdict): string {
  if (originality.verdict === "new") return `nessuna (${originality.reason})`;
  return `${originality.verdict} vs ${originality.matchedStrategyId} — ${originality.reason}`;
}

function renderDiscardedIdea(entry: DiscardedIdeaEntry): string {
  const technicalFailures = entry.gates.checks.filter((c) => c.passed !== true && c.name !== "sufficiently_original");
  const overfittingRisks = entry.idea.initial_research_parameters.map((p) => `${p.name}=${p.overfitting_risk}`).join(", ") || "n.d.";
  return [
    `### ${entry.idea.name}`,
    "",
    `- nome sintetico: ${entry.idea.name}`,
    `- motivo: ${entry.reason}`,
    `- duplicazione rilevata: ${originalityLabel(entry.originality)}`,
    `- limite tecnico: ${technicalFailures.length > 0 ? technicalFailures.map((c) => `${c.name} (${c.detail})`).join("; ") : "nessuno"}`,
    `- rischio di overfitting: ${overfittingRisks}`,
  ].join("\n");
}

function renderDeterministicRules(idea: HypothesisIdea): string {
  const r = idea.deterministic_rules;
  const lines = [
    `Filtro regime: ${r.regime_filter}`,
    `Filtro higher timeframe: ${r.htf_filter}`,
    `Setup: ${r.setup}`,
    `Trigger: ${r.trigger}`,
    `Ingresso: ${r.entry}`,
    `Stop: ${r.stop_loss}`,
    `Invalidazione: ${r.invalidation}`,
    `Target: ${r.target}`,
    `Uscita anticipata: ${r.early_exit}`,
    `Time stop: ${r.time_stop}`,
    `Gestione barre non chiuse: ${r.unclosed_bar_handling}`,
    `Cooldown: ${r.cooldown}`,
    `Pyramiding: ${r.pyramiding}`,
  ];
  if (r.direction_long) lines.push(`Direzione long: ${r.direction_long}`);
  if (r.direction_short) lines.push(`Direzione short: ${r.direction_short}`);
  lines.push(`Sessione: ${r.session_rules}`, `Esclusioni: ${r.exclusions}`, `Gestione gap: ${r.gap_handling}`, `Gestione volatilità eccezionale: ${r.exceptional_volatility_handling}`);
  return lines.join("\n\n");
}

function renderInitialParameters(idea: HypothesisIdea): string {
  return idea.initial_research_parameters
    .map((p) =>
      [
        `- ${p.name}`,
        `  - valore iniziale: ${p.initial_value}`,
        `  - range di ricerca: ${p.search_range}`,
        `  - motivazione: ${p.rationale}`,
        `  - rischio di overfitting: ${p.overfitting_risk}`,
      ].join("\n"),
    )
    .join("\n");
}

function renderResearchPlan(idea: HypothesisIdea): string {
  return [
    `- simboli: ${idea.initial_symbols.join(", ")}`,
    `- provider: ${idea.compatible_providers.join(", ") || "n.d."}`,
    `- timeframe: contesto=${idea.timeframe_context}, setup=${idea.timeframe_setup}, trigger=${idea.timeframe_trigger}`,
    "- in-sample / validation / out-of-sample: split per tradingview-strategy-research/validation-protocol.md una volta definite le finestre in config/validation.yaml",
    "- costi: commissioni/spread/slippage inclusi per default (config/validation.yaml include_commissions/include_spread/include_slippage)",
    "- stress test: cost-sensitivity e parameter-stability una volta disponibili dati di backtest reali",
    `- benchmark: ${idea.falsifiability.benchmark}`,
    "- numero minimo di trade: per config/validation.yaml minimum_total_trades",
  ].join("\n");
}

function renderQualityGateSection(gates: QualityGateResult): string {
  const lines = [
    `- falsificabile: ${sinoNullable(gate(gates.checks, "falsifiable").passed)}`,
    `- codificabile: ${sinoNullable(gate(gates.checks, "codifiable").passed)}`,
    `- dati disponibili: ${sinoNullable(gate(gates.checks, "data_available").passed)}`,
    `- nessun look-ahead: ${sinoNullable(gate(gates.checks, "no_lookahead").passed)}`,
    `- nessun repainting necessario: ${sinoNullable(gate(gates.checks, "no_repainting_required").passed)}`,
    `- costi simulabili: ${sinoNullable(gate(gates.checks, "costs_simulable").passed)}`,
    `- stop/invalidazione definibili: ${sinoNullable(gate(gates.checks, "stop_definable").passed)}`,
    `- originale: ${sinoNullable(gate(gates.checks, "sufficiently_original").passed)}`,
    `- complessità accettabile: ${sinoNullable(gate(gates.checks, "complexity_acceptable").passed)}`,
    `- numero parametri accettabile: ${sinoNullable(gate(gates.checks, "parameter_count_acceptable").passed)}`,
    `- pronta per research: ${gates.accepted ? "sì" : "no"}`,
  ];
  return lines.join("\n");
}

function renderProposedIdea(entry: IdeaReportEntry, index: number): string {
  const { idea } = entry;
  return [
    `### ${index}. ${idea.name}`,
    "",
    `ID proposto: ${idea.id}`,
    `Famiglia: ${idea.family}`,
    "Stato proposto: experimental",
    `Mercati target: ${idea.target_markets.join(", ")}`,
    `Simboli iniziali: ${idea.initial_symbols.join(", ")}`,
    `Timeframe: contesto=${idea.timeframe_context}, setup=${idea.timeframe_setup}, trigger=${idea.timeframe_trigger}`,
    `Regimi target: ${idea.target_regimes.join(", ") || "n.d."}`,
    `Regimi esclusi: ${idea.excluded_regimes.join(", ") || "n.d."}`,
    `Sessioni: ${idea.sessions.join(", ") || "n.d."}`,
    `Direzioni: ${idea.directions.join(", ")}`,
    `Frequenza attesa: ${idea.expected_frequency}`,
    `Complessità: ${idea.complexity}`,
    "",
    "#### Ipotesi",
    "",
    idea.synthesis,
    "",
    idea.market_behavior_exploited,
    "",
    "#### Motivazione economica o comportamentale",
    "",
    idea.economic_or_behavioral_rationale,
    "",
    "#### Regole deterministiche preliminari",
    "",
    renderDeterministicRules(idea),
    "",
    "#### Parametri iniziali (initial_research_parameters — punti di partenza per la ricerca, non valori ottimali)",
    "",
    renderInitialParameters(idea),
    "",
    "#### Requisiti dati",
    "",
    renderList(idea.data_requirements, "nessuno dichiarato"),
    `- dipendenza da volume: ${idea.volume_dependency ? "sì" : "no"}`,
    `- dipendenza da dati multi-symbol: ${idea.multi_symbol_dependency ? "sì" : "no"}`,
    `- sensibilità attesa a costi: ${idea.expected_cost_sensitivity}`,
    "",
    "#### Assunzioni",
    "",
    renderList(idea.falsifiability.key_assumptions, "nessuna dichiarata"),
    "",
    "#### Rischi",
    "",
    renderList([...idea.falsifiability.possible_biases, ...idea.falsifiability.cost_sensitivity_risks], "nessuno dichiarato"),
    "",
    "#### Condizioni di fallimento",
    "",
    "Rejection (rejected):",
    renderList(idea.falsifiability.rejection_conditions, "nessuna dichiarata"),
    "",
    "Needs more data (needs_more_data):",
    renderList(idea.falsifiability.needs_more_data_conditions, "nessuna dichiarata"),
    "",
    "Segnali contrari all'ipotesi da osservare:",
    renderList(idea.falsifiability.contrary_signals, "nessuno dichiarato"),
    "",
    "Mercati da non usare per questa idea:",
    renderList(idea.falsifiability.excluded_markets, "nessuno dichiarato"),
    "",
    "#### Piano di ricerca suggerito",
    "",
    renderResearchPlan(idea),
    "",
    "#### Differenza rispetto alle strategie esistenti",
    "",
    `${originalityLabel(entry.originality)}\n\n${idea.differentiation_notes}`,
    "",
    "#### Quality gate",
    "",
    renderQualityGateSection(entry.gates),
  ].join("\n");
}

export function renderIdeaReport(input: IdeaReportInput): string {
  const frontmatter = GenerationReportFrontmatterSchema.parse({
    date: input.date,
    registry_strategies_count: input.registryStrategiesCount,
    ideas_proposed: input.proposed.length,
    ideas_discarded: input.discarded.length,
    constraints_received: input.constraintsReceived,
  });

  const sections = [
    `---
date: ${frontmatter.date}
registry_strategies_count: ${frontmatter.registry_strategies_count}
ideas_proposed: ${frontmatter.ideas_proposed}
ideas_discarded: ${frontmatter.ideas_discarded}
constraints_received: "${frontmatter.constraints_received}"
---`,
    "",
    "# Strategy Generation Report",
    "",
    `Data e ora UTC: ${frontmatter.date}`,
    `Registry analizzato: strategies/registry.yaml`,
    `Strategie presenti: ${input.gapAnalysis.totalStrategies}`,
    "",
    "Strategie per stato:",
    "",
    renderRecord(input.gapAnalysis.byStatus),
    "",
    "Gap individuati:",
    "",
    renderList(input.gapAnalysis.gaps, "nessun gap rilevato"),
    "",
    `Vincoli ricevuti: ${input.constraintsReceived || "(nessuno — invocazione senza flag)"}`,
    "",
    "## Idee scartate immediatamente",
    "",
    input.discarded.length > 0 ? input.discarded.map(renderDiscardedIdea).join("\n\n") : "_(nessuna idea scartata in questa run)_",
    "",
    "## Idee proposte",
    "",
    input.proposed.length > 0 ? input.proposed.map((entry, i) => renderProposedIdea(entry, i + 1)).join("\n\n") : "_(nessuna idea proposta in questa run)_",
    "",
    "## Raccomandazione",
    "",
    input.recommendation,
    "",
  ];

  return sections.join("\n");
}

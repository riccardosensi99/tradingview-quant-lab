import { describe, expect, it } from "vitest";
import { renderIdeaReport, type IdeaReportInput } from "../scripts/generation/idea-report.js";
import { analyzeRegistryGaps } from "../scripts/generation/registry-analysis.js";
import { runQualityGates } from "../scripts/generation/quality-gates.js";
import { makeHypothesisIdea } from "./hypothesis-fixtures.js";
import type { OriginalityVerdict } from "../scripts/generation/originality-check.js";

const NEW_VERDICT: OriginalityVerdict = { verdict: "new", reason: "no matching entry found in the registry" };

function baseInput(overrides: Partial<IdeaReportInput> = {}): IdeaReportInput {
  const idea = makeHypothesisIdea();
  const gates = runQualityGates(idea, NEW_VERDICT);
  return {
    date: "2026-07-20T18:00:00Z",
    registryStrategiesCount: 1,
    constraintsReceived: "--count 1",
    gapAnalysis: analyzeRegistryGaps({ strategies: [] }),
    discarded: [],
    proposed: [{ idea, originality: NEW_VERDICT, gates }],
    recommendation: "Send vol-compression-breakout-1 to tradingview-strategy-research.",
    ...overrides,
  };
}

describe("renderIdeaReport", () => {
  it("produces an identical string for identical input (determinism)", () => {
    const input = baseInput();
    const first = renderIdeaReport(input);
    const second = renderIdeaReport(input);
    expect(first).toBe(second);
  });

  it("renders valid sections with zero proposed and zero discarded ideas", () => {
    const output = renderIdeaReport(baseInput({ proposed: [], discarded: [] }));
    expect(output).toContain("_(nessuna idea scartata in questa run)_");
    expect(output).toContain("_(nessuna idea proposta in questa run)_");
    expect(output).toContain("# Strategy Generation Report");
    expect(output).toContain("## Raccomandazione");
  });

  it("keeps sections in the fixed documented order", () => {
    const output = renderIdeaReport(baseInput());
    const headerIdx = output.indexOf("# Strategy Generation Report");
    const discardedIdx = output.indexOf("## Idee scartate immediatamente");
    const proposedIdx = output.indexOf("## Idee proposte");
    const recommendationIdx = output.indexOf("## Raccomandazione");
    expect(headerIdx).toBeGreaterThanOrEqual(0);
    expect(discardedIdx).toBeGreaterThan(headerIdx);
    expect(proposedIdx).toBeGreaterThan(discardedIdx);
    expect(recommendationIdx).toBeGreaterThan(proposedIdx);
  });

  it("renders every initial research parameter with its search range and overfitting risk, never as an optimal value", () => {
    const output = renderIdeaReport(baseInput());
    expect(output).toContain("valore iniziale:");
    expect(output).toContain("range di ricerca:");
    expect(output).toContain("rischio di overfitting:");
    expect(output).toContain("initial_research_parameters — punti di partenza per la ricerca, non valori ottimali");
  });

  it("renders a null quality gate as a non-affirmative, never as a silent pass", () => {
    const idea = makeHypothesisIdea();
    idea.falsifiability.benchmark = "";
    const gates = runQualityGates(idea, NEW_VERDICT);
    const output = renderIdeaReport(baseInput({ proposed: [{ idea, originality: NEW_VERDICT, gates }] }));
    expect(output).toContain("- falsificabile: no (dati insufficienti)");
  });

  it("includes valid frontmatter with the correct proposed/discarded counts", () => {
    const output = renderIdeaReport(baseInput());
    expect(output).toMatch(/^---\ndate: 2026-07-20T18:00:00Z\n/);
    expect(output).toContain("ideas_proposed: 1");
    expect(output).toContain("ideas_discarded: 0");
  });
});

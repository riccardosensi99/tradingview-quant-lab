// Compares a freshly generated hypothesis against strategies/registry.yaml
// to flag near-duplicates before a new entry is proposed — see
// .claude/skills/tradingview-strategy-generator/generation-protocol.md §8
// (controllo di originalità). Deterministic token-overlap heuristic, not
// fuzzy/ML matching: registry entries only retain prose (`notes`,
// `description`) plus a handful of structured tags (`family`,
// `regimes_supported`, `directions_supported`, `parameters`) — the full
// deterministic-rules text of a past idea lives only in its
// reports/ideas/*.md report, not in the registry, so this can only compare
// against what the registry actually stores.

import type { HypothesisIdea } from "../schemas/hypothesis.js";
import type { StrategyRegistry, StrategyRegistryEntry, TradeDirection } from "../schemas/registry.js";

export type OriginalityVerdict =
  | { verdict: "new"; reason: string }
  | { verdict: "variant_of_existing"; matchedStrategyId: string; sharedDimensions: string[]; reason: string }
  | { verdict: "parameter_stability_candidate"; matchedStrategyId: string; sharedDimensions: string[]; reason: string }
  | { verdict: "duplicate"; matchedStrategyId: string; sharedDimensions: string[]; reason: string };

/** Minimum count of shared significant (>=4 char) text tokens between the
 * idea's descriptive text and an entry's `notes`/`description` to call it a
 * duplicate rather than merely a variant. */
export const DUPLICATE_TEXT_OVERLAP_TOKENS = 5;

/** Minimum Jaccard overlap of proposed parameter *names* (not values) for a
 * same-family/regime/direction match to be treated as "explore this
 * parameter on the existing strategy" rather than "propose a new one". */
export const PARAMETER_NAME_OVERLAP_RATIO = 0.5;

const VERDICT_SEVERITY: Record<OriginalityVerdict["verdict"], number> = {
  new: 0,
  variant_of_existing: 1,
  parameter_stability_candidate: 2,
  duplicate: 3,
};

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 4),
  );
}

function ideaDescriptiveText(idea: HypothesisIdea): string {
  const ruleValues = Object.values(idea.deterministic_rules).filter((v): v is string => typeof v === "string");
  return [idea.synthesis, idea.market_behavior_exploited, idea.economic_or_behavioral_rationale, ...ruleValues].join(" ");
}

function entryDescriptiveText(entry: StrategyRegistryEntry): string {
  return [entry.description ?? "", entry.notes ?? ""].join(" ");
}

function overlapCount<T>(a: Set<T> | T[], b: Set<T> | T[]): T[] {
  const setB = new Set(b);
  return [...new Set(a)].filter((item) => setB.has(item));
}

function entryParameterNames(entry: StrategyRegistryEntry): string[] {
  const raw = entry.parameters?.["initial_research_parameters"];
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p): p is { name: unknown } => typeof p === "object" && p !== null && "name" in p)
    .map((p) => p.name)
    .filter((name): name is string => typeof name === "string");
}

function jaccard(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size === 0 && setB.size === 0) return 0;
  const intersection = [...setA].filter((x) => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

function compareAgainstEntry(idea: HypothesisIdea, entry: StrategyRegistryEntry): OriginalityVerdict {
  const sharedFamily = entry.family !== undefined && entry.family === idea.family;
  if (!sharedFamily) {
    return { verdict: "new", reason: `no family match against ${entry.id}` };
  }

  const regimeOverlap = overlapCount(idea.target_regimes, entry.regimes_supported ?? []);
  const directionOverlap = overlapCount<TradeDirection>(idea.directions, entry.directions_supported ?? []);
  const sharedDimensions = ["family", ...(regimeOverlap.length > 0 ? ["regime"] : []), ...(directionOverlap.length > 0 ? ["direction"] : [])];

  if (regimeOverlap.length === 0 && directionOverlap.length === 0) {
    return { verdict: "new", reason: `family=${entry.family} matches ${entry.id} but no regime/direction overlap` };
  }

  const textOverlap = overlapCount(tokenize(ideaDescriptiveText(idea)), tokenize(entryDescriptiveText(entry)));
  if (regimeOverlap.length > 0 && directionOverlap.length > 0 && textOverlap.length >= DUPLICATE_TEXT_OVERLAP_TOKENS) {
    return {
      verdict: "duplicate",
      matchedStrategyId: entry.id,
      sharedDimensions,
      reason: `same family/regime/direction as ${entry.id}, plus ${textOverlap.length} shared descriptive terms (>= ${DUPLICATE_TEXT_OVERLAP_TOKENS})`,
    };
  }

  const paramOverlapRatio = jaccard(idea.initial_research_parameters.map((p) => p.name), entryParameterNames(entry));
  if (regimeOverlap.length > 0 && directionOverlap.length > 0 && paramOverlapRatio >= PARAMETER_NAME_OVERLAP_RATIO) {
    return {
      verdict: "parameter_stability_candidate",
      matchedStrategyId: entry.id,
      sharedDimensions,
      reason: `same family/regime/direction as ${entry.id} and ${Math.round(paramOverlapRatio * 100)}% overlap in proposed parameter names — consider a parameter-stability experiment on ${entry.id} instead of a new strategy`,
    };
  }

  return {
    verdict: "variant_of_existing",
    matchedStrategyId: entry.id,
    sharedDimensions,
    reason: `shares family and ${sharedDimensions.slice(1).join("/") || "no further dimensions"} with ${entry.id} but is otherwise distinguishable`,
  };
}

export function checkOriginality(idea: HypothesisIdea, registry: StrategyRegistry): OriginalityVerdict {
  let best: OriginalityVerdict = { verdict: "new", reason: "no matching entry found in the registry" };

  for (const entry of registry.strategies) {
    const verdict = compareAgainstEntry(idea, entry);
    if (VERDICT_SEVERITY[verdict.verdict] > VERDICT_SEVERITY[best.verdict]) {
      best = verdict;
    }
  }

  return best;
}

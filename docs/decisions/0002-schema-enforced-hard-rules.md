# 0002. Hard risk/validation rules enforced at the schema level

Status: Accepted
Date: 2026-07-20

## Context

The research spec this project was originally built from lists several rules as absolute, never-conditional: no martingale sizing, no averaging down, no recovery sizing after a loss, no strategy marked validated if it repaints or has look-ahead bias. The natural first approach is to document these rules in `STEERING.md`/`SKILL.md` and trust the code that reads `config/*.yaml` to respect them.

## Decision

Where a rule is meant to be truly non-negotiable, it's encoded directly in the Zod schema, not just documented:

- `RiskConfigSchema`: `allow_martingale`, `allow_averaging_down`, `allow_recovery_sizing` are typed `z.literal(false)` — the schema rejects a config file that sets any of them `true`, at load time, before any risk logic even runs.
- `ValidationConfigSchema`: `reject_repainting`, `reject_lookahead_bias` are typed `z.literal(true)` — same mechanism, inverted.
- `classify.ts` treats a code-review finding of repainting or look-ahead bias as an unconditional `rejected` verdict, computed *before* any metric-based criterion is even evaluated, so no combination of good metrics can override it.

## Alternatives considered

- **Document only, trust callers.** Rejected: this is exactly the kind of rule where "we documented it" has failed before in trading-system contexts (the original spec's own extensive anti-hallucination section exists because of that failure mode) — a config typo or a well-intentioned override would silently defeat the rule with no error anywhere.
- **Runtime assertion inside the risk/validation functions themselves**, checked on every call. Considered viable but rejected in favor of the schema-level pin: catching it at config *load* time (via `loadYaml`, which already throws a descriptive `YamlValidationError` on any schema violation) means the failure surfaces immediately when someone edits the YAML, not only when a specific code path happens to exercise it later.

## Consequences

- A config change that tries to weaken one of these rules fails loudly and immediately (`YamlValidationError`), not silently or downstream.
- Adding a new hard-forbidden behavior later means adding a `z.literal` field to the relevant schema plus wiring the corresponding check into `classify.ts` (for validation-side rules) — there's a clear, consistent place to put the next one (see STEERING.md §20).
- This only covers rules expressible as a fixed boolean config value. Rules that depend on runtime data (e.g. "no position sizing based on a losing streak") still need an explicit check in the code path that has access to that data — the schema can't enforce those.

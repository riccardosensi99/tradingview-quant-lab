// Generic "read YAML file, validate against a Zod schema" loader.
//
// No silent fallbacks: a missing file, unparseable YAML, or a schema
// violation all throw. Callers get a typed, validated object or an error —
// never a partially-defaulted guess.

import { readFileSync } from "node:fs";
import { parse } from "yaml";
import type { z } from "zod";

export class YamlValidationError extends Error {
  constructor(filePath: string, issues: string) {
    super(`Invalid YAML at ${filePath}:\n${issues}`);
    this.name = "YamlValidationError";
  }
}

export function loadYaml<T extends z.ZodTypeAny>(filePath: string, schema: T): z.infer<T> {
  const raw = readFileSync(filePath, "utf8");
  const parsed: unknown = parse(raw);
  const result = schema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new YamlValidationError(filePath, issues);
  }
  return result.data;
}

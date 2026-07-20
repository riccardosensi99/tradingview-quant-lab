// Extracts and validates the YAML frontmatter block (between the first two
// `---` lines) of a Markdown report file. Same no-silent-fallback contract as
// load-yaml.ts: a missing/malformed frontmatter block throws.

import { readFileSync } from "node:fs";
import { parse } from "yaml";
import type { z } from "zod";
import { YamlValidationError } from "./load-yaml.js";

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;

export function readFrontmatter<T extends z.ZodTypeAny>(filePath: string, schema: T): z.infer<T> {
  const raw = readFileSync(filePath, "utf8");
  const match = FRONTMATTER_PATTERN.exec(raw);
  if (!match) {
    throw new Error(`No YAML frontmatter block found at ${filePath}`);
  }
  const parsed: unknown = parse(match[1]);
  const result = schema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new YamlValidationError(filePath, issues);
  }
  return result.data;
}

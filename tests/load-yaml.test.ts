import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { loadYaml, YamlValidationError } from "../scripts/lib/load-yaml.js";

describe("loadYaml error handling (no silent fallbacks)", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "load-yaml-test-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("throws when the file does not exist", () => {
    expect(() => loadYaml(join(dir, "missing.yaml"), z.object({}))).toThrow();
  });

  it("throws on unparseable YAML", () => {
    const file = join(dir, "broken.yaml");
    writeFileSync(file, "key: [unclosed");
    expect(() => loadYaml(file, z.object({ key: z.string() }))).toThrow();
  });

  it("throws YamlValidationError with a readable message on schema mismatch", () => {
    const file = join(dir, "wrong-shape.yaml");
    writeFileSync(file, "name: 42\n");
    try {
      loadYaml(file, z.object({ name: z.string() }));
      expect.unreachable("expected loadYaml to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(YamlValidationError);
      expect((err as Error).message).toContain("name");
    }
  });

  it("returns the validated data on success — no coercion beyond the schema's own defaults", () => {
    const file = join(dir, "ok.yaml");
    writeFileSync(file, "name: hello\ncount: 3\n");
    const data = loadYaml(file, z.object({ name: z.string(), count: z.number() }));
    expect(data).toEqual({ name: "hello", count: 3 });
  });
});

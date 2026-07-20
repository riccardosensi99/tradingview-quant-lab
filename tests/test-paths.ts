import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const testsDir = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(testsDir, "..");

export function repoPath(...segments: string[]): string {
  return resolve(repoRoot, ...segments);
}

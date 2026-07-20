import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Exclude compiled output explicitly — `npm run build` emits mirrored
    // .test.js files into dist/tests/ which would otherwise be picked up
    // and run a second time with paths resolved relative to dist/.
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});

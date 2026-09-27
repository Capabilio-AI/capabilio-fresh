import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    // Vitest's own sensible defaults (node_modules at any depth, .next,
    // etc.) get REPLACED, not merged, once `exclude` is set at all — this
    // must list every depth explicitly. Missed this the first time: a
    // worktree lives inside this repo's own directory tree, so its nested
    // node_modules (e.g. zod's bundled test suite) got scanned too.
    exclude: ["**/node_modules/**", "**/.next/**", "**/.claude/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
});

import { defineConfig } from "vitest/config";
import path from "node:path";

// *.live.test.ts hit the real Supabase project (service role) and external
// services; they only run via `npm run test:live` (LIVE_DB=1).
const live = process.env.LIVE_DB === "1";

export default defineConfig({
  test: {
    environment: "node",
    include: live ? ["**/*.live.test.ts"] : ["**/*.test.ts"],
    // Vitest's own sensible defaults (node_modules at any depth, .next,
    // etc.) get REPLACED, not merged, once `exclude` is set at all — this
    // must list every depth explicitly. Missed this the first time: a
    // worktree lives inside this repo's own directory tree, so its nested
    // node_modules (e.g. zod's bundled test suite) got scanned too.
    exclude: ["**/node_modules/**", "**/.next/**", "**/.claude/**", ...(live ? [] : ["**/*.live.test.ts"])],
    testTimeout: live ? 300_000 : 5_000,
    hookTimeout: live ? 300_000 : 10_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
});

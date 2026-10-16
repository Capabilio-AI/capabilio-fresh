import { describe, expect, it } from "vitest";
import { runFrontendChecks } from "./checks";
import { FRONTEND_TEMPLATES } from "./tickets";

describe("fixed frontend tickets", () => {
  for (const t of FRONTEND_TEMPLATES) {
    it(`${t.id}: the solution passes every check and the starter does not`, () => {
      const files = t.draft.content.files.map((f) => t.solution.find((s) => s.name === f.name) ?? f);
      expect(runFrontendChecks(files, t.draft.key.checks).every((r) => r.passed), `${t.id} solution`).toBe(true);
      const starter = runFrontendChecks(t.draft.content.files, t.draft.key.checks);
      expect(starter.filter((r) => !r.passed).length).toBeGreaterThanOrEqual(2);
      if (t.areas[0] === "frontend-debugging") expect(starter.some((r) => r.passed)).toBe(true);
      expect(t.draft.content.requirements).toHaveLength(t.draft.key.checks.length);
    });
  }
});

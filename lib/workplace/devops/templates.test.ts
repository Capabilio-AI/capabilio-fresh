import { describe, expect, it } from "vitest";
import { runChecks } from "./checks";
import { DEVOPS_TEMPLATES } from "./tickets";

describe("fixed DevOps tickets", () => {
  for (const t of DEVOPS_TEMPLATES) {
    it(`${t.id}: the solution passes every check and the starter does not`, () => {
      expect(runChecks(t.solution, t.draft.key.checks).every((r) => r.passed)).toBe(true);
      const starter = runChecks(t.draft.content.files, t.draft.key.checks);
      expect(starter.filter((r) => !r.passed).length).toBeGreaterThanOrEqual(2);
      expect(t.draft.content.requirements).toHaveLength(t.draft.key.checks.length);
    });
  }
});

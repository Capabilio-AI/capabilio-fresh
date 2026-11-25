import { describe, expect, it } from "vitest";
import { ROLE_LESSONS, findRoleLesson } from "./index";

describe("role lessons", () => {
  for (const [role, lessons] of Object.entries(ROLE_LESSONS)) {
    it(`${role}: lessons are well-formed, in order, with a recorded output for every example`, () => {
      expect(new Set(lessons.map((l) => l.key)).size).toBe(lessons.length);
      for (const l of lessons) {
        expect(l.sections.length).toBeGreaterThan(0);
        expect(l.check.length).toBe(3);
        for (const s of l.sections) {
          expect(s.example.code.trim().length).toBeGreaterThan(0);
          expect(s.example.output.trim().length, `${l.key}/${s.heading}`).toBeGreaterThan(0);
          // a recorded output must never contain a runtime warning or an error
          expect(s.example.output).not.toMatch(/Warning|Traceback|ERROR:/);
        }
        for (const c of l.check) {
          expect(c.options).toHaveLength(4);
          expect(new Set(c.options).size).toBe(4);
          expect(c.answerIndex).toBeGreaterThanOrEqual(0);
          expect(c.answerIndex).toBeLessThan(4);
          expect(c.why.length).toBeGreaterThan(10);
        }
      }
    });
  }
  it("finds a lesson by role and key, and nothing for an unknown one", () => {
    expect(findRoleLesson("data-scientist", "profile-a-table")?.title).toContain("Profile");
    expect(findRoleLesson("data-scientist", "nope")).toBeUndefined();
    expect(findRoleLesson("other-role", "profile-a-table")).toBeUndefined();
  });
});

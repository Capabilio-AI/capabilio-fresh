import { describe, expect, it } from "vitest";
import { assessCurriculum } from "./quality";

const c = (id: string, title: string, over: Partial<{ year: number; hasContent: boolean; usableSkills: number }> = {}) => ({ id, title, year: 2, hasContent: true, usableSkills: 2, ...over });

describe("assessCurriculum", () => {
  it("finds a course that was read but got no skills", () => {
    const r = assessCurriculum([c("1", "Artificial Intelligence", { usableSkills: 0 }), c("2", "Machine Learning")]);
    expect(r.contentWithoutSkills).toEqual(["Artificial Intelligence"]);
    expect(r.coverage).toBe(0.5);
  });
  it("finds a course listed twice under different punctuation", () => {
    expect(assessCurriculum([c("1", "Generative A.I", { hasContent: false, usableSkills: 0 }), c("2", "GENERATIVE AI")]).duplicates).toEqual([["Generative A.I", "GENERATIVE AI"]]);
  });
  it("does not call the same subject in different years a duplicate", () => {
    expect(assessCurriculum([c("1", "DBMS", { year: 2 }), c("2", "DBMS", { year: 4 })]).duplicates).toEqual([]);
  });
  it("lists courses with nothing read", () => expect(assessCurriculum([c("1", "Open elective", { hasContent: false, usableSkills: 0 })]).withoutContent).toEqual(["Open elective"]));
});

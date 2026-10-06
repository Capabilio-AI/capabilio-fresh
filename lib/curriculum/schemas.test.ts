import { describe, expect, it } from "vitest";
import { AddCoursesSchema, ConfirmHighSchema, CourseTreeSchema, CreateImportSchema, DecisionsSchema, MergeSchema, UpdateImportSchema, toTreeJson } from "./schemas";

const U = "7f3c1c0e-1c2b-4c9e-9a53-0b6f1d9d2a11";

describe("CourseTreeSchema", () => {
  it("accepts a partial edit and a full tree", () => {
    expect(CourseTreeSchema.safeParse({ title: "Algorithms" }).success).toBe(true);
    expect(CourseTreeSchema.safeParse({ title: "A", year: 2, semester: 1, courseCode: "CS201", credits: 3, objectives: ["x y z"], outcomes: [{ code: "CO1", text: "Do the thing well", bloomLevel: "Apply" }], units: [{ unitNo: 1, title: "Intro", hours: 8, topics: ["Big O"] }], experiments: ["Implement sort"] }).success).toBe(true);
  });
  it("is strict: no institution, import or status can ride along", () => {
    for (const extra of [{ institutionId: U }, { importId: U }, { status: "PUBLISHED" }, { deletedAt: "x" }]) expect(CourseTreeSchema.safeParse({ title: "A", ...extra }).success).toBe(false);
  });
  it("rejects duplicate outcome codes and duplicate unit numbers", () => {
    expect(CourseTreeSchema.safeParse({ outcomes: [{ code: "CO1", text: "first outcome" }, { code: "CO1", text: "second outcome" }] }).success).toBe(false);
    expect(CourseTreeSchema.safeParse({ units: [{ unitNo: 1, title: "a", topics: [] }, { unitNo: 1, title: "b", topics: [] }] }).success).toBe(false);
  });
  it("bounds sizes and values", () => {
    expect(CourseTreeSchema.safeParse({ year: 7 }).success).toBe(false);
    expect(CourseTreeSchema.safeParse({ title: "x".repeat(201) }).success).toBe(false);
    expect(CourseTreeSchema.safeParse({ credits: -1 }).success).toBe(false);
    expect(CourseTreeSchema.safeParse({ outcomes: [{ code: "CO 1; drop", text: "a long enough text" }] }).success).toBe(false);
    expect(CourseTreeSchema.safeParse({ outcomes: [{ code: "CO1", text: "a long enough text", bloomLevel: "Mastery" }] }).success).toBe(false);
  });
  it("maps to the snake_case payload only for the keys that were sent", () => {
    expect(toTreeJson({ title: "A", courseCode: "X1", outcomes: [{ code: "CO1", text: "text here ok", bloomLevel: "Apply" }], units: [{ unitNo: 2, title: "U", hours: null, topics: ["t"] }] })).toEqual({
      title: "A", course_code: "X1", outcomes: [{ code: "CO1", text: "text here ok", bloom_level: "Apply" }], units: [{ unit_no: 2, title: "U", hours: null, topics: ["t"] }],
    });
    expect(toTreeJson({})).toEqual({});
  });
});

describe("other request schemas", () => {
  it("create/update import", () => {
    expect(CreateImportSchema.safeParse({ branch: "Computer Science and Engineering", regulation: "R23" }).success).toBe(true);
    expect(CreateImportSchema.safeParse({ branch: "" }).success).toBe(false);
    expect(UpdateImportSchema.safeParse({ status: "UNDER_REVIEW" }).success).toBe(true);
    expect(UpdateImportSchema.safeParse({ status: "PUBLISHED" }).success).toBe(false);
    expect(UpdateImportSchema.safeParse({}).success).toBe(false);
    expect(UpdateImportSchema.safeParse({ institutionId: U, regulation: "R20" }).success).toBe(false);
  });
  it("add courses", () => {
    expect(AddCoursesSchema.safeParse({ courses: [{ year: 2, title: "DBMS" }] }).success).toBe(true);
    expect(AddCoursesSchema.safeParse({ courses: [] }).success).toBe(false);
    expect(AddCoursesSchema.safeParse({ courses: [{ year: 9, title: "x" }] }).success).toBe(false);
  });
  it("mapping decisions", () => {
    expect(DecisionsSchema.safeParse({ decisions: [{ skillId: U, decision: "confirm" }, { skillId: U, decision: "reject", outcomeId: U }] }).success).toBe(true);
    expect(DecisionsSchema.safeParse({ decisions: [{ skillId: U, decision: "confirm" }, { skillId: U, decision: "reject" }] }).success).toBe(false); // ambiguous: same skill twice
    expect(DecisionsSchema.safeParse({ decisions: [{ skillId: U, decision: "approve" }] }).success).toBe(false);
    expect(DecisionsSchema.safeParse({ decisions: [{ skillId: "not-a-uuid", decision: "confirm" }] }).success).toBe(false);
    expect(DecisionsSchema.safeParse({ decisions: [{ skillId: U, decision: "confirm", approvedBy: U }] }).success).toBe(false); // who approved is never client-supplied
  });
  it("bulk confirm and merge", () => {
    expect(ConfirmHighSchema.safeParse({ preview: true }).success).toBe(true);
    expect(ConfirmHighSchema.parse({ preview: true }).minConfidence).toBe(0.9);
    expect(ConfirmHighSchema.safeParse({ preview: false, minConfidence: 0.2, expectedCount: 3 }).success).toBe(false);
    expect(ConfirmHighSchema.safeParse({ preview: false }).success).toBe(false); // cannot confirm without having previewed
    expect(ConfirmHighSchema.safeParse({ preview: false, expectedCount: 12 }).success).toBe(true);
    expect(MergeSchema.safeParse({ intoCourseId: U }).success).toBe(true);
    expect(MergeSchema.safeParse({ intoCourseId: "x" }).success).toBe(false);
  });
});

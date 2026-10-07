import { describe, expect, it } from "vitest";
import { buildSkillIndex } from "@/lib/skills/resolve";
import { buildFromTemplate } from "./build";
import { parseCsv } from "./csv";
import { parseCurriculumTemplate, bloomOf } from "./parse";
import { templateCsv } from "./spec";

const H = "row_type,year,semester,course_code,course_title,kind,category,credits,lecture_hours,tutorial_hours,practical_hours,prerequisites,ref,text,value\n";
const ok = (body: string) => {
  const r = parseCurriculumTemplate(H + body);
  if (!r.ok) throw new Error(JSON.stringify(r.issues));
  return r;
};
const issues = (body: string) => {
  const r = parseCurriculumTemplate(H + body);
  return r.ok ? [] : r.issues.map((i) => i.message);
};

describe("parseCsv", () => {
  it("handles quoted commas, doubled quotes, line breaks inside a cell, a BOM and CRLF", () => {
    const rows = parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n"two\nlines",z\r\n');
    expect(rows.map((r) => r.cells)).toEqual([["a", "b"], ["x, y", 'say "hi"'], ["two\nlines", "z"]]);
    expect(rows[2].line).toBe(3);
  });
  it("reads a semicolon-separated file (Excel in some locales)", () => {
    expect(parseCsv("a;b\n1;2\n").map((r) => r.cells)).toEqual([["a", "b"], ["1", "2"]]);
  });
});

describe("parseCurriculumTemplate", () => {
  it("builds the whole tree from one file, in any row order", () => {
    const r = ok(
      [
        "TOPIC,,,CS201,,,,,,,,,1,Stacks",
        "COURSE,2,1,CS201,Data Structures,,Professional Core,3,3,0,0,C basics",
        "UNIT,,,CS201,,,,,,,,,1,Linear structures,10",
        "OUTCOME,,,CS201,,,,,,,,,CO1,Implement stacks,K3",
        "BOOK,,,CS201,,,,,,,,,reference,Cormen",
        "SKILL,,,CS201,,,,,,,,,1,Data Structures,CORE",
      ].join("\n")
    );
    const [c] = r.courses;
    expect(c).toMatchObject({ code: "CS201", year: 2, semester: 1, kind: "course", credits: 3, prerequisites: "C basics" });
    expect(c.units[0]).toMatchObject({ unitNo: 1, hours: 10, topics: ["Stacks"] });
    expect(c.outcomes[0]).toMatchObject({ code: "CO1", bloom: "Apply" });
    expect(c.referenceBooks).toEqual(["Cormen"]);
    expect(c.skills[0]).toMatchObject({ scope: { type: "unit", unitNo: 1 }, importance: "CORE" });
  });

  it("derives year and semester from a programme semester 1-8, and the kind from title and category", () => {
    const r = ok(["COURSE,,5,A1,Operating Systems Lab,,,,,,,", "COURSE,,8,A2,Cloud Computing,,Professional Elective,,,,,"].join("\n"));
    expect(r.courses.map((c) => [c.year, c.semester, c.kind])).toEqual([[3, 1, "lab"], [4, 2, "elective_option"]]);
  });

  it("numbers outcomes when no ref is given", () => {
    const r = ok(["COURSE,1,1,M1,Maths,,,,,,,", "OUTCOME,,,M1,,,,,,,,,,First,", "OUTCOME,,,M1,,,,,,,,,,Second,"].join("\n"));
    expect(r.courses[0].outcomes.map((o) => o.code)).toEqual(["CO1", "CO2"]);
  });

  it("reports every problem with its line, not just the first", () => {
    const msgs = issues(
      [
        "COURSE,1,3,A,Physics,,,,,,,",
        "COURSE,1,1,B,Chemistry,,,,,,,",
        "COURSE,1,1,B,Chemistry again,,,,,,,",
        "UNIT,,,Z,,,,,,,,,1,Orphan,",
        "TOPIC,,,B,,,,,,,,,9,No such unit",
        "SKILL,,,B,,,,,,,,,CO4,Data Structures,HUGE",
        "WIDGET,,,B,,,,,,,,,,x,",
      ].join("\n")
    );
    expect(msgs.length).toBeGreaterThanOrEqual(6);
    expect(msgs.join("\n")).toMatch(/semester must be 1 or 2/);
    expect(msgs.join("\n")).toMatch(/used by another course/);
    expect(msgs.join("\n")).toMatch(/does not match any COURSE/);
    expect(msgs.join("\n")).toMatch(/no UNIT row/);
    expect(msgs.join("\n")).toMatch(/CORE, SUPPORTING or MINOR/);
    expect(msgs.join("\n")).toMatch(/row_type "WIDGET"/);
  });

  it("rejects a file that still holds the example rows", () => {
    const r = parseCurriculumTemplate(templateCsv());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues[0].message).toMatch(/example rows/);
  });

  it("refuses a file without the required columns", () => {
    const r = parseCurriculumTemplate("name,code\nx,y\n");
    expect(r.ok).toBe(false);
  });

  it("keeps a skill pinned to an outcome only if the outcome exists", () => {
    expect(issues(["COURSE,1,1,A,Maths,,,,,,,", "SKILL,,,A,,,,,,,,,CO2,Calculus,"].join("\n")).join()).toMatch(/not an outcome/);
  });
});

describe("bloomOf", () => {
  it("maps K-levels and words, and rejects anything else", () => {
    expect(bloomOf("K2")).toBe("Understand");
    expect(bloomOf("analyze")).toBe("Analyze");
    expect(bloomOf("fast")).toBeNull();
  });
});

describe("buildFromTemplate", () => {
  const index = buildSkillIndex([{ id: "s1", name: "Data Structures", status: "active" }, { id: "s2", name: "Algorithms", status: "active" }], [{ skillId: "s2", alias: "algos" }]);
  const parsed = ok(
    [
      "COURSE,2,1,CS201,Data Structures,,,,,,,",
      "OUTCOME,,,CS201,,,,,,,,,CO1,Implement,",
      "UNIT,,,CS201,,,,,,,,,1,Linear,",
      "SKILL,,,CS201,,,,,,,,,,data structures,CORE",
      "SKILL,,,CS201,,,,,,,,,CO1,algos,",
      "SKILL,,,CS201,,,,,,,,,1,Algorithms,MINOR",
      "SKILL,,,CS201,,,,,,,,,,Quantum Basket Weaving,",
      "COURSE,2,2,CS202,Compilers,,,,,,,",
    ].join("\n")
  );
  const built = buildFromTemplate(parsed.courses, index);

  it("turns skills the list knows into declared (confirmed) mappings with their importance", () => {
    const m = built.declared[0];
    expect(m.map((x) => [x.skillId, x.importance])).toEqual([["s1", "CORE"], ["s2", "MINOR"]]);
    expect(m.find((x) => x.skillId === "s2")?.outcomeCodes).toEqual(["CO1"]);
    expect(built.courses.every((c) => c.mappings.length === 0)).toBe(true); // the extraction writer only ever sees AI-style rows: none
  });
  it("records unit-level skills, reports unknown skills, and flags courses with nothing to analyse", () => {
    expect(built.unitSkills).toEqual([{ courseIndex: 0, unitNo: 1, skillId: "s2" }]);
    expect(built.unmatchedSkills).toEqual([expect.objectContaining({ name: "Quantum Basket Weaving", course: "CS201" })]);
    expect(built.thinCourses).toEqual(["CS202"]);
  });
  it("never confirms a merely similar skill name", () => {
    const near = buildFromTemplate(ok(["COURSE,1,1,A,X,,,,,,,", "SKILL,,,A,,,,,,,,,,Data Structure,"].join("\n")).courses, index);
    expect(near.declared[0]).toEqual([]);
    expect(near.unmatchedSkills).toHaveLength(1);
  });
});

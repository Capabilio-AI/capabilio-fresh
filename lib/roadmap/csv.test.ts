import { describe, expect, it } from "vitest";
import { parseCurriculumCsv } from "./csv";

describe("parseCurriculumCsv", () => {
  it("parses rows, optional columns and quoted commas", () => {
    const r = parseCurriculumCsv('branch,year,semester,subject_name,subject_code\nCSE,2,1,"Data Structures, Algorithms",CS201\nCSE,3,,DBMS,\n');
    expect(r).toEqual({ ok: true, rows: [
      { branch: "CSE", year: 2, semester: 1, name: "Data Structures, Algorithms", code: "CS201" },
      { branch: "CSE", year: 3, semester: null, name: "DBMS", code: null },
    ] });
  });
  it("reports every bad line instead of silently dropping rows", () => {
    const r = parseCurriculumCsv("branch,year,subject_name\nCSE,9,X\n,2,Y\nCSE,2,\n");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toHaveLength(3);
  });
  it("rejects a missing header and an empty file", () => {
    expect(parseCurriculumCsv("foo,bar\n1,2").ok).toBe(false);
    expect(parseCurriculumCsv("  \n").ok).toBe(false);
  });
});

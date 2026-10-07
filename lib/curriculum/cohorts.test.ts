import { describe, expect, it } from "vitest";
import type { ImportListItem } from "./admin-data";
import { buildBoards, type StudentRow } from "./cohorts";

const imp = (branch: string, regulation: string | null, status: ImportListItem["status"]) =>
  ({ id: `${branch}-${regulation}-${status}`, branch, regulation, status, createdAt: "", publishedAt: null, versionNo: null, summary: {} }) as unknown as ImportListItem;
const stu = (branch: string | null, regulation: string | null, endYear: number | null = 2027): StudentRow => ({ branch, regulation, endYear });

describe("buildBoards", () => {
  it("groups curricula by branch (case-insensitive) and counts students by regulation", () => {
    const [b] = buildBoards(
      [imp("CSE", "R20", "PUBLISHED"), imp("cse ", "R23", "PUBLISHED")],
      [stu("cse", "R23"), stu("CSE", "r23"), stu("CSE", "R20"), stu("CSE", null)]
    );
    expect(b.imports).toHaveLength(2);
    expect(b.students).toBe(4);
    expect(b.byRegulation.map((r) => [r.regulation, r.students, r.published])).toEqual([["R23", 2, true], ["R20", 1, true]]);
    expect(b.regulationUnset).toBe(1);
    expect(b.withoutPublished).toBe(0);
  });

  it("flags students whose regulation has no published curriculum", () => {
    const [b] = buildBoards([imp("CSE", "R23", "DRAFT")], [stu("CSE", "R23"), stu("CSE", "R23"), stu("CSE", "R19")]);
    expect(b.withoutPublished).toBe(3);
    expect(b.byRegulation.find((r) => r.regulation === "R23")).toMatchObject({ published: false, hasDraft: true });
    expect(b.publishedRegulations).toEqual([]);
    expect(b.knownRegulations).toEqual(["R23"]);
  });

  it("keeps a student branch spelled differently from every curriculum as its own board", () => {
    const boards = buildBoards([imp("Computer Science and Engineering (CSE)", "R23", "PUBLISHED")], [stu("CSE", null), stu("CSE", null)]);
    expect(boards.map((b) => b.branch)).toEqual(["CSE", "Computer Science and Engineering (CSE)"]);
    expect(boards[0].imports).toHaveLength(0);
    expect(boards[0].students).toBe(2);
  });

  it("lists graduating years once, ascending, and ignores students with no branch", () => {
    const [b] = buildBoards([], [stu("ECE", null, 2028), stu("ECE", null, 2027), stu("ECE", null, 2027), stu(null, null)]);
    expect(b.endYears).toEqual([2027, 2028]);
    expect(b.students).toBe(3);
  });
});

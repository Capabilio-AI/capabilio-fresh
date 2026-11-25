import { describe, expect, it } from "vitest";
import { TRACKS } from "./index";
import { hasArenaExam, levelOfModule, levelRows, levelsOf, provenLevels } from "./levels";
import { moduleStatuses, isProven, type ModuleProofRow } from "./module-gate";
import { cTrack } from "./c";

describe("levels", () => {
  it("gives every language four levels that together hold every module, in order, each with at least one module", () => {
    for (const t of TRACKS) {
      const levels = levelsOf(t);
      expect(levels.map((l) => l.n)).toEqual([1, 2, 3, 4]);
      expect(levels.flatMap((l) => l.modules.map((m) => m.key))).toEqual(t.modules.map((m) => m.key));
      for (const l of levels) expect(l.modules.length, `${t.key} level ${l.n}`).toBeGreaterThan(0);
    }
  });
  it("puts a course's first module in Basic and its last in Expert", () => {
    expect(levelOfModule(cTrack, cTrack.modules[0].key)).toBe(1);
    expect(levelOfModule(cTrack, cTrack.modules[cTrack.modules.length - 1].key)).toBe(4);
  });
  it("proves a level only when its modules are proven and (for Arena-exam languages) its exam is passed, and only in order", () => {
    const all = () => true;
    expect(hasArenaExam("c")).toBe(true);
    expect(provenLevels(cTrack, all, [])).toEqual([]);
    expect(provenLevels(cTrack, all, [1])).toEqual([1]);
    expect(provenLevels(cTrack, all, [2])).toEqual([]);
    expect(provenLevels(cTrack, all, [1, 2, 3, 4])).toEqual([1, 2, 3, 4]);
    const sql = TRACKS.find((t) => t.key === "sql")!;
    expect(provenLevels(sql, all, [])).toEqual([1, 2, 3, 4]);
  });
  it("shows a level ready for its exam once every module of it is proven", () => {
    const first = new Set(levelsOf(cTrack)[0].modules.map((m) => m.key));
    const rows = levelRows(cTrack, (m) => first.has(m.key), []);
    expect(rows.map((r) => r.status)).toEqual(["exam", "locked", "locked", "locked"]);
  });
  it("keeps Level 2 modules locked until the Level 1 exam is passed, even when every Level 1 module is proven", () => {
    const proven = (k: string): ModuleProofRow => ({ assessmentPassedAt: "x", problemPassedAt: "x" } as ModuleProofRow);
    const rows = Object.fromEntries(levelsOf(cTrack)[0].modules.map((m) => [m.key, proven(m.key)]));
    const firstOfTwo = cTrack.modules.indexOf(levelsOf(cTrack)[1].modules[0]);
    expect(moduleStatuses(cTrack, rows, [])[firstOfTwo]).toBe("locked");
    expect(moduleStatuses(cTrack, rows, [1])[firstOfTwo]).toBe("open");
    expect(isProven(cTrack, cTrack.modules[0], rows[cTrack.modules[0].key])).toBe(true);
  });
});

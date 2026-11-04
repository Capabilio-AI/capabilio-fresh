import { describe, expect, it } from "vitest";
import { groupShares, onePerShare, shortBranch, summariseAudience, type ShareRow } from "./material-share";

const row = (id: string, share: string, branch: string, year: number, over: Partial<ShareRow> = {}): ShareRow => ({
  id, share_id: share, type: "file", title: "Data Analytics Made Accessible", description: null, file_path: "p/f.pdf", file_name: "f.pdf", file_size: 3_600_000,
  url: null, body: null, branch, year, subject_id: null, author_membership_id: "m1", published_at: "2026-11-04T16:21:00Z", ...over,
});
const ALL = ["Artificial Intelligence and Machine Learning (AI/ML)", "Computer Science and Engineering (CSE)", "Electrical and Electronics Engineering (EEE)"];

describe("groupShares", () => {
  it("turns twelve rows of one share into one item with twelve audiences", () => {
    const rows = ALL.flatMap((b, i) => [1, 2, 3, 4].map((y) => row(`r${i}${y}`, "s1", b, y)));
    const shares = groupShares(rows);
    expect(shares).toHaveLength(1);
    expect(shares[0].audiences).toHaveLength(12);
    expect(shares[0].rowIds).toHaveLength(12);
  });
  it("keeps different shares apart and puts the newest first", () => {
    const out = groupShares([row("a", "s1", ALL[0], 1), row("b", "s2", ALL[0], 1, { published_at: "2026-11-05T09:00:00Z", title: "Newer" })]);
    expect(out.map((s) => s.title)).toEqual(["Newer", "Data Analytics Made Accessible"]);
  });
});

describe("summariseAudience", () => {
  const all = ALL.flatMap((b) => [1, 2, 3, 4].map((year) => ({ branch: b, year })));
  it("says so when everything is covered", () => {
    expect(summariseAudience(all, ALL).chips).toEqual(["All branches · All years"]);
  });
  it("folds branches that share the same years", () => {
    const some = [ALL[0], ALL[1]].flatMap((b) => [2, 3].map((year) => ({ branch: b, year })));
    expect(summariseAudience(some, ALL).chips).toEqual(["2 branches · Years 2–3"]);
  });
  it("lists a branch with its own years when they differ", () => {
    const mixed = [{ branch: ALL[1], year: 1 }, { branch: ALL[1], year: 2 }, { branch: ALL[2], year: 4 }];
    expect(summariseAudience(mixed, ALL).chips).toEqual(["CSE · Years 1–2", "EEE · Year 4"]);
  });
  it("gives the full sentence for a tooltip", () => {
    expect(summariseAudience([{ branch: ALL[1], year: 2 }], ALL).full).toBe("Computer Science and Engineering (CSE) · Year 2");
  });
});

describe("shortBranch", () => {
  it("prefers the code in brackets", () => {
    expect(shortBranch(ALL[1])).toBe("CSE");
    expect(shortBranch("Mechanical Engineering")).toBe("Mechanical Engineering");
  });
});

describe("onePerShare", () => {
  const copies = [1, 2, 3, 4].map((year) => ({ share_id: "s1", year, id: `c${year}` }));
  it("gives a student one copy: their own year when there is one", () => {
    expect(onePerShare(copies, 2).map((c) => c.id)).toEqual(["c2"]);
  });
  it("falls back to the nearest year, and to the latest when the year is unknown", () => {
    expect(onePerShare(copies.filter((c) => c.year !== 3), 3).map((c) => c.id)).toEqual(["c2"]);
    expect(onePerShare(copies, null).map((c) => c.id)).toEqual(["c4"]);
  });
  it("keeps separate shares separate", () => {
    const rows = [...copies, { share_id: "s2", year: 1, id: "z1" }];
    expect(onePerShare(rows, 2).map((c) => c.id)).toEqual(["c2", "z1"]);
  });
});

import { describe, expect, it } from "vitest";
import { estimateSemester, totalYearsOf } from "./position";
import { rankCareersForExploration } from "./explore";
import { canonicalInput, hashSnapshot, inferTrigger, stableStringify } from "./snapshot";
import { checkExplanation } from "./explanation";

describe("estimateSemester (an estimate from the calendar — the product no longer records a student's semester)", () => {
  it("the first six months after the academic cycle starts are semester 1, the rest semester 2", () => {
    // cycle starts in July: Jul–Dec = semester 1, Jan–Jun = semester 2
    expect([7, 8, 9, 10, 11, 12].map((m) => estimateSemester(new Date(2026, m - 1, 15), 7))).toEqual([1, 1, 1, 1, 1, 1]);
    expect([1, 2, 3, 4, 5, 6].map((m) => estimateSemester(new Date(2026, m - 1, 15), 7))).toEqual([2, 2, 2, 2, 2, 2]);
  });
  it("respects the institution's own cycle start", () => {
    expect(estimateSemester(new Date(2026, 8, 1), 8)).toBe(1); // September, cycle starts August
    expect(estimateSemester(new Date(2026, 1, 1), 8)).toBe(2); // February
    expect(estimateSemester(new Date(2026, 0, 31), 1)).toBe(1); // January start
  });
});

describe("totalYearsOf", () => {
  it("is the program length, with sane bounds and a default of 4", () => {
    expect(totalYearsOf(2023, 2027)).toBe(4);
    expect(totalYearsOf(2023, 2026)).toBe(3);
    expect(totalYearsOf(null, 2027)).toBe(4);
    expect(totalYearsOf(2023, null)).toBe(4);
    expect(totalYearsOf(2023, 2040)).toBe(6);
    expect(totalYearsOf(2027, 2023)).toBe(4);
  });
});

describe("rankCareersForExploration (a student who is still exploring)", () => {
  const req = (skillId: string, importance: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW", targetLevel: number) => ({ skillId, importance, targetLevel });
  const careers = [
    { id: "da", name: "Data Analyst", requirements: [req("sql", "CRITICAL", 80), req("stats", "HIGH", 70)] },
    { id: "se", name: "Software Engineer", requirements: [req("dsa", "CRITICAL", 80), req("oop", "HIGH", 70)] },
    { id: "pm", name: "Product Manager", requirements: [req("pm", "CRITICAL", 80)] },
  ];
  const lvl = (level: number) => ({ level, confidence: 0.7, verified: true, verifiedLevel: level, selfDeclaredLevel: null });
  it("ranks by how close the student already is plus how much their curriculum already covers, best first", () => {
    const r = rankCareersForExploration(careers, { sql: lvl(70), stats: lvl(60) }, [{ skills: [{ skillId: "sql", importance: "CORE" }, { skillId: "stats", importance: "CORE" }] }]);
    expect(r.map((x) => x.careerId)).toEqual(["da", "pm", "se"]);
    expect(r[0].score).toBeGreaterThan(r[1].score);
  });
  it("with no evidence and no curriculum there is no basis to rank: ties break by name, scores are 0", () => {
    const r = rankCareersForExploration(careers, {}, []);
    expect(r.map((x) => x.score)).toEqual([0, 0, 0]);
    expect(r.map((x) => x.careerName)).toEqual(["Data Analyst", "Product Manager", "Software Engineer"]);
  });
  it("is deterministic", () => {
    const a = rankCareersForExploration(careers, { sql: lvl(50) }, []);
    expect(rankCareersForExploration([...careers].reverse(), { sql: lvl(50) }, [])).toEqual(a);
  });
});

describe("snapshot hashing and trigger inference", () => {
  it("stableStringify ignores key order, so the same inputs always hash the same", () => {
    expect(stableStringify({ b: 1, a: { d: [3, { y: 1, x: 2 }], c: null } })).toBe(stableStringify({ a: { c: null, d: [3, { x: 2, y: 1 }] }, b: 1 }));
    expect(hashSnapshot({ a: 1, b: 2 })).toBe(hashSnapshot({ b: 2, a: 1 }));
    expect(hashSnapshot({ a: 1 })).not.toBe(hashSnapshot({ a: 2 }));
    expect(hashSnapshot({ a: 1 })).toMatch(/^[0-9a-f]{64}$/);
  });
  it("infers why a new version exists: a new curriculum, a first roadmap for a career, or progress; MANUAL when the student asked", () => {
    const snap = (curriculumVersionId: string | null, extra: Record<string, unknown> = {}) => ({ curriculumVersionId, ...extra });
    expect(inferTrigger(null, snap("v1"))).toBe("CAREER_CHANGE");
    expect(inferTrigger(snap("v1"), snap("v2"))).toBe("CURRICULUM_PUBLISHED");
    expect(inferTrigger(snap("v1", { x: 1 }), snap("v1", { x: 2 }))).toBe("PROGRESS_UPDATE");
    expect(inferTrigger(snap("v1"), snap("v2"), "MANUAL")).toBe("MANUAL");
    expect(inferTrigger(null, snap("v1"), "MANUAL")).toBe("MANUAL");
  });
});

describe("checkExplanation (an AI sentence may only restate the facts it was given)", () => {
  const facts = { skillNames: ["SQL", "Data Cleaning"], outcomeCount: 3, gapPoints: 60 };
  const all = ["SQL", "Data Cleaning", "Python", "Statistics", "Algorithms"];
  it("accepts one short sentence that mentions only skills from the facts and numbers from the facts", () => {
    expect(checkExplanation("This course builds SQL and Data Cleaning, backed by 3 of its outcomes.", facts, all)).toEqual({ ok: true });
    expect(checkExplanation("It supports SQL, one of your biggest gaps.", facts, all)).toEqual({ ok: true });
  });
  it("rejects a skill that is not among the facts, even one that exists in the catalog", () => {
    expect(checkExplanation("This course also teaches Python.", facts, all)).toMatchObject({ ok: false });
    expect(checkExplanation("Builds SQL and Statistics.", facts, all)).toMatchObject({ ok: false });
  });
  it("rejects numbers that are not in the facts, multiple sentences, empty and over-long text", () => {
    expect(checkExplanation("Builds SQL with 12 outcomes.", facts, all)).toMatchObject({ ok: false });
    expect(checkExplanation("Builds SQL. It is great.", facts, all)).toMatchObject({ ok: false });
    expect(checkExplanation("", facts, all)).toMatchObject({ ok: false });
    expect(checkExplanation(`Builds SQL ${"really ".repeat(60)}well.`, facts, all)).toMatchObject({ ok: false });
  });
  it("rejects anything that tells the student to skip or ignore a subject", () => {
    expect(checkExplanation("Builds SQL, so you can skip your other subjects.", facts, all)).toMatchObject({ ok: false });
    expect(checkExplanation("Builds SQL; ignore the rest.", facts, all)).toMatchObject({ ok: false });
  });
});

describe("canonicalInput (Postgres returns rows in no promised order)", () => {
  const make = (flip: boolean) => {
    const f = <T,>(xs: T[]) => (flip ? [...xs].reverse() : xs);
    return {
      requirements: f([{ skillId: "a" }, { skillId: "b" }, { skillId: "c" }]),
      courses: f([{ id: "c1", skills: f([{ skillId: "a" }, { skillId: "b" }]), prerequisiteCourseIds: f(["x", "y"]) }, { id: "c2", skills: [], prerequisiteCourseIds: [] }]),
      catalogs: {
        learning: f([{ id: "l1", skillIds: f(["a", "b"]), prerequisites: [] }, { id: "l2", skillIds: ["c"], prerequisites: [] }]),
        certifications: f([{ id: "k1", skillIds: f(["a", "b"]), careers: f([{ careerId: "p" }, { careerId: "q" }]) }, { id: "k2", skillIds: [], careers: [] }]),
        projects: f([{ id: "p1", skillIds: f(["a", "b"]), expectedEvidence: [] }, { id: "p2", skillIds: [], expectedEvidence: [] }]),
        arena: f([{ id: "a1", skillIds: f(["a", "b"]) }, { id: "a2", skillIds: [] }]),
      },
    };
  };
  it("the same data in any order canonicalises — and hashes — identically", () => {
    expect(canonicalInput(make(true))).toEqual(canonicalInput(make(false)));
    expect(hashSnapshot(canonicalInput(make(true)))).toBe(hashSnapshot(canonicalInput(make(false))));
    expect(hashSnapshot(make(true))).not.toBe(hashSnapshot(make(false))); // without it, order alone would change the hash
  });
  it("changes only order, never content", () => {
    const c = canonicalInput(make(true));
    expect(c.requirements.map((r) => r.skillId)).toEqual(["a", "b", "c"]);
    expect(c.courses.map((x) => x.id)).toEqual(["c1", "c2"]);
    expect(c.catalogs.learning[0].skillIds).toEqual(["a", "b"]);
    expect(c.catalogs.certifications[0].careers.map((x) => x.careerId)).toEqual(["p", "q"]);
  });
});

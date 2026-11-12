import { describe, expect, it, vi } from "vitest";
import { extraEvidenceId } from "./arena-rules";

// the modules under test import the database client, which reads its settings when loaded; no connection is ever made here
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??= "test-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-key";
});
vi.mock("next/server", () => ({ after: (f: () => void) => f() }));
vi.mock("./graph-sync", () => ({ syncSkillGraph: vi.fn() }));
vi.mock("./roadmap", () => ({ refreshRoadmap: vi.fn() }));

import { careerPassGain, failedShare, missChange } from "./arena-rules";
import { recordArenaMiss } from "./arena";
import { syncSkillGraph } from "./graph-sync";

const checks = (...passed: boolean[]) => passed.map((p, i) => ({ label: `c${i}`, passed: p }));

describe("a wrong answer is scored by the answer", () => {
  it("measures how much of the answer was wrong as the share of checks it failed", () => {
    expect(failedShare(checks(true, true, false))).toBeCloseTo(1 / 3);
    expect(failedShare(checks(false, false, false))).toBe(1);
    expect(failedShare(checks(true, false))).toBe(0.5);
  });

  it("treats an answer that could not be checked at all as wholly wrong", () => {
    expect(failedShare([])).toBe(1);
  });

  it("takes that share out of what the ticket is worth", () => {
    expect(missChange(12, checks(true, true, false))).toBe(-4); // a third of 12
    expect(missChange(12, checks(false, false, false))).toBe(-12); // all of it
    expect(missChange(8, checks(true, false))).toBe(-4);
  });

  it("is never free: even a nearly right answer costs at least 1", () => {
    expect(missChange(4, checks(...Array.from({ length: 19 }, () => true), false))).toBe(-1);
  });

  it("depends on the answer and the ticket only: the same answer costs more on a more valuable ticket", () => {
    expect(missChange(15, checks(true, false))).toBeLessThan(missChange(8, checks(true, false)));
    expect(missChange(8, checks(false, false))).toBeLessThan(missChange(8, checks(true, false)));
  });

  it("uses what a pass raises the career ELO by (easy 4, medium 8, hard 12), not the assessment's +4 / -2", () => {
    expect([careerPassGain("easy"), careerPassGain("medium"), careerPassGain("hard")]).toEqual([4, 8, 12]);
  });
});

function fakeDb(opts: { career?: boolean; rpc?: { data?: unknown; error?: unknown } }) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: opts.career === false ? null : { id: "career-1" } }) };
  return {
    calls,
    db: {
      from: (t: string) => (t === "careers" ? chain : { insert: async () => ({ error: null }) }),
      rpc: async (fn: string, args: Record<string, unknown>) => {
        calls.push({ fn, args });
        return opts.rpc ?? { data: { replayed: false, careerChange: -3, areaChange: -4, careerRating: 397 }, error: null };
      },
    } as never,
  };
}
const miss = { attemptId: "a1", roleKey: "data-analyst", careerChange: -3, areaChange: -4, reason: "final answer was wrong" };

describe("recordArenaMiss", () => {
  it("applies exactly the changes it is given to both ratings, once per ticket, through its own function and not the assessment rule", async () => {
    const { db, calls } = fakeDb({});
    expect(await recordArenaMiss("u1", miss, db)).toEqual({ careerChange: -3, areaChange: -4 });
    expect(calls).toHaveLength(1);
    expect(calls[0].fn).toBe("apply_arena_miss");
    expect(calls[0].args).toMatchObject({ p_attempt: "a1", p_career: "career-1", p_career_change: -3, p_area_change: -4 });
    expect(calls.some((c) => c.fn === "apply_elo_event")).toBe(false);
  });

  it("charges nothing for a role with no career row, and never throws when the database fails", async () => {
    expect(await recordArenaMiss("u1", miss, fakeDb({ career: false }).db)).toBeNull();
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await recordArenaMiss("u1", miss, fakeDb({ rpc: { error: new Error("db down") } }).db)).toBeNull();
    spy.mockRestore();
  });
});

describe("a miss is evidence too", () => {
  function evidenceDb(replayed: boolean) {
    const upserts: Record<string, unknown>[] = [];
    const careers = { select: () => careers, eq: () => careers, maybeSingle: async () => ({ data: { id: "career-1" } }) };
    const skills = { select: () => skills, in: async () => ({ data: [{ id: "s1", name: "SQL" }, { id: "s2", name: "Joins" }] }) };
    const evidence = { upsert: async (row: Record<string, unknown>) => { upserts.push(row); return { error: null }; } };
    const db = {
      from: (t: string) => (t === "careers" ? careers : t === "skills" ? skills : t === "student_skill_evidence" ? evidence : { insert: async () => ({ error: null }) }),
      rpc: async () => ({ data: { replayed, careerChange: -2, areaChange: -4, careerRating: 412 }, error: null }),
    } as never;
    return { db, upserts };
  }
  const withSkills = { ...miss, skillId: "s1", extraSkillIds: ["s2"], difficulty: "easy" as const };

  it("records a wrong answer for every skill the ticket exercises and refreshes the skill graph", async () => {
    vi.mocked(syncSkillGraph).mockClear();
    const { db, upserts } = evidenceDb(false);
    await recordArenaMiss("u1", withSkills, db);
    expect(upserts).toHaveLength(2);
    expect(upserts.every((r) => r.correct === false && r.source === "ARENA" && r.difficulty === "EASY")).toBe(true);
    expect(upserts.map((r) => r.source_id)).toEqual(["a1", extraEvidenceId("a1", "s2")]);
    expect(syncSkillGraph).toHaveBeenCalledTimes(1);
  });

  it("does nothing twice when the miss is replayed", async () => {
    vi.mocked(syncSkillGraph).mockClear();
    const { db, upserts } = evidenceDb(true);
    await recordArenaMiss("u1", withSkills, db);
    expect(upserts).toHaveLength(0);
    expect(syncSkillGraph).not.toHaveBeenCalled();
  });
});


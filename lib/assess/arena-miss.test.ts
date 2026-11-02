import { describe, expect, it, vi } from "vitest";
import { MAX_CHARGED_MISSES, missCost, missIsCharged, scaleForElo } from "./arena-rules";
import { missEventId } from "./arena-penalty";

// the modules under test import the database client, which reads its settings when loaded; no connection is ever made here
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??= "test-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-key";
});

vi.mock("next/server", () => ({ after: (f: () => void) => f() }));
vi.mock("./graph-sync", () => ({ syncSkillGraph: vi.fn() }));
vi.mock("./roadmap", () => ({ refreshRoadmap: vi.fn() }));

import { recordArenaMiss } from "./arena";

describe("what a wrong answer costs", () => {
  it("is half of what the ticket earns: +8, +12 and +15 cost 4, 6 and 8", () => {
    expect([8, 12, 15].map(missCost)).toEqual([4, 6, 8]);
  });

  it("charges only the first few wrong answers on one ticket", () => {
    expect([0, 1, 2, 3, 4, 9].map(missIsCharged)).toEqual([false, true, true, true, false, false]);
    expect(MAX_CHARGED_MISSES).toBe(3);
  });

  it("agrees with the ledger: the ARENA rule's -2 through the ticket's own scale is what is shown", () => {
    // apply_elo_event: round(incorrect_delta(-2) * scale), scale = elo / 4
    for (const elo of [8, 12, 15]) expect(Math.round(Math.abs(-2 * scaleForElo(elo)))).toBe(missCost(elo));
  });
});

describe("one ledger event per wrong answer", () => {
  it("makes the same id every time for the same attempt and answer, and a different one otherwise", () => {
    expect(missEventId("a1", 1)).toBe(missEventId("a1", 1));
    const ids = new Set([missEventId("a1", 0), missEventId("a1", 1), missEventId("a1", 2), missEventId("a2", 1)]);
    expect(ids.size).toBe(4);
  });

  it("is a valid uuid, which is what the ledger column holds, and never equal to the attempt id used for a pass", () => {
    expect(missEventId("a1", 1)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(missEventId("11111111-1111-1111-1111-111111111111", 1)).not.toBe("11111111-1111-1111-1111-111111111111");
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
        return opts.rpc ?? { data: { change: -4, newRating: 396, previous: 400 }, error: null };
      },
    } as never,
  };
}
const miss = { attemptId: "a1", roleKey: "data-analyst", submissionNumber: 1, elo: 8, reason: "wrong answer 1" };

describe("recordArenaMiss", () => {
  it("lowers the career rating through the same ledger a pass raises, marked as an incorrect ARENA event", async () => {
    const { db, calls } = fakeDb({});
    const r = await recordArenaMiss("u1", miss, db);
    expect(r).toEqual({ elo: 396, change: -4 });
    expect(calls[0].fn).toBe("apply_elo_event");
    expect(calls[0].args).toMatchObject({ p_student: "u1", p_career: "career-1", p_source: "ARENA", p_correct: false, p_scale: 2, p_source_id: missEventId("a1", 1) });
  });

  it("charges nothing for a role with no career row, and never throws when the ledger fails", async () => {
    expect(await recordArenaMiss("u1", miss, fakeDb({ career: false }).db)).toBeNull();
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await recordArenaMiss("u1", miss, fakeDb({ rpc: { error: new Error("db down") } }).db)).toBeNull();
    spy.mockRestore();
  });
});

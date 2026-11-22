import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveGoal } from "./resolve";

const careers = [{ key: "backend-developer", name: "Backend Developer", description: null }, { key: "data-analyst", name: "Data Analyst", description: null }];
const published = [{ key: "fashion-designer", name: "Fashion Designer", kind: "portfolio", aliases: ["fashion design"] }];

function fakeService() {
  const upserts: { table: string; row: Record<string, unknown>; opts: unknown }[] = [];
  const service = {
    from: (table: string) => ({
      select: () => ({ eq: () => Promise.resolve({ data: careers }) }),
      upsert: (row: Record<string, unknown>, opts: unknown) => { upserts.push({ table, row, opts }); return Promise.resolve({ error: null }); },
    }),
  } as unknown as SupabaseClient;
  return { service, upserts };
}
const deps = (hits: { key: string; confidence: number }[] | Error) => ({
  pathways: async () => published,
  suggestCareers: async () => { if (hits instanceof Error) throw hits; return hits; },
});

describe("resolveGoal", () => {
  it("finds a published pathway and records nothing", async () => {
    const { service, upserts } = fakeService();
    const r = await resolveGoal(service, "u1", "I want to become a fashion designer", deps([]));
    expect(r.outcome).toBe("pathway");
    expect(r.pathways[0].key).toBe("fashion-designer");
    expect(upserts).toEqual([]);
  });
  it("finds a job role above the confidence floor and drops one below it", async () => {
    const { service } = fakeService();
    const r = await resolveGoal(service, "u1", "backend", deps([{ key: "backend-developer", confidence: 0.9 }, { key: "data-analyst", confidence: 0.3 }]));
    expect(r.outcome).toBe("career");
    expect(r.careers.map((c) => c.key)).toEqual(["backend-developer"]);
  });
  it("answers both when a goal is a pathway and a role", async () => {
    const { service } = fakeService();
    expect((await resolveGoal(service, "u1", "fashion designer", deps([{ key: "data-analyst", confidence: 0.8 }]))).outcome).toBe("both");
  });
  it("records an uncovered goal once, under a wording-independent key", async () => {
    const { service, upserts } = fakeService();
    const r = await resolveGoal(service, "u1", "I want to become a Deep Sea Diver!", deps([]));
    expect(r).toMatchObject({ outcome: "none", recorded: true });
    expect(upserts).toHaveLength(1);
    expect(upserts[0].table).toBe("goal_requests");
    expect(upserts[0].row).toMatchObject({ user_id: "u1", goal_key: "deep sea diver" });
    expect(upserts[0].opts).toMatchObject({ onConflict: "user_id,goal_key", ignoreDuplicates: true });
  });
  it("still returns the pathway when the job-role matcher fails, and records nothing then", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { service, upserts } = fakeService();
    const r = await resolveGoal(service, "u1", "fashion designer", deps(new Error("model down")));
    expect(r.outcome).toBe("pathway");
    expect(upserts).toEqual([]);
    spy.mockRestore();
  });
  it("says it cannot tell, and records nothing, when the job-role matcher fails and no pathway matches: the goal may be a job role", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { service, upserts } = fakeService();
    const r = await resolveGoal(service, "u1", "backend developer", deps(new Error("model down")));
    expect(r).toMatchObject({ outcome: "unavailable", recorded: false });
    expect(upserts).toEqual([]);
    spy.mockRestore();
  });
});

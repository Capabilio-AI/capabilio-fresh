import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createThrowawayUser, deleteThrowawayUser, liveServiceClient } from "@/lib/arena-workstations/live-test-helpers";
import { untyped } from "@/lib/org/db";
import { loadDomainSet, recommendChallengesForSkill } from "./domain-set";
import { loadStreamPool } from "./stream-context";

// Live: selection reads real published rows and respects status, career links, and the student's own intent.
const service = liveServiceClient();
const db = untyped(service);
const created: string[] = [];
let userId: string;
let careerA: { id: string; skillId: string };
let careerB: string;
const SCOPE = "zz-live-selection";

const insertChallenge = async (over: Record<string, unknown>) => {
  const { data, error } = await db
    .from("arena_challenges")
    .insert({ track: "domain", scope_key: SCOPE, title: "live selection test", category: "t", difficulty: "easy", scenario: "s", objective: "o", language: "sql", expected_output: "", source: "CAPABILIO", ...over })
    .select("id")
    .single();
  if (error) throw error;
  created.push(data.id);
  return data.id as string;
};

beforeAll(async () => {
  userId = await createThrowawayUser(service, "selection");
  const { data: reqs } = await service.from("career_skill_requirements").select("career_id, skill_id").limit(200);
  const first = reqs![0];
  careerA = { id: first.career_id, skillId: first.skill_id };
  careerB = (reqs!.find((r) => r.career_id !== first.career_id) ?? first).career_id;
});
afterAll(async () => {
  if (created.length) await db.from("arena_challenges").delete().in("id", created);
  await deleteThrowawayUser(service, userId);
});

describe("domain set", () => {
  it("never guesses a career for a student with no intent", async () => {
    expect((await loadDomainSet(service, userId, "primary")).state).toBe("unset");
    await service.from("student_career_intent").insert({ student_id: userId, is_exploring: true });
    expect((await loadDomainSet(service, userId, "primary")).state).toBe("exploring");
  });

  it("lists only PUBLISHED challenges linked to the chosen career and explains them with real numbers", async () => {
    await service.from("student_career_intent").upsert({ student_id: userId, primary_career_id: careerA.id, secondary_career_id: careerB === careerA.id ? null : careerB, is_exploring: false });
    const published = await insertChallenge({ status: "PUBLISHED", title: "live published" });
    const draft = await insertChallenge({ status: "DRAFT", title: "live draft" });
    for (const id of [published, draft]) {
      await db.from("challenge_careers").insert({ challenge_id: id, career_id: careerA.id });
      await db.from("arena_challenge_skills").insert({ challenge_id: id, skill_id: careerA.skillId, source: "SPEC" });
    }

    const view = await loadDomainSet(service, userId, "primary");
    if (view.state !== "ready") throw new Error(`expected ready, got ${view.state}`);
    // seeded, published challenges for the same career may exist too: look at this test's own
    expect(view.items.map((i) => i.id)).toContain(published);
    expect(view.items.map((i) => i.id)).not.toContain(draft);
    const mine = view.items.find((i) => i.id === published)!;
    expect(mine.why).toMatch(/Recommended because/);
    expect(mine.startable).toBe(false); // no workstation attached yet

    const recs = await recommendChallengesForSkill(service, userId, careerA.skillId, careerA.id);
    expect(recs.map((r) => r.id)).toContain(published);
    expect(recs.map((r) => r.id)).not.toContain(draft);
  });

  it("switches to Plan B and reports a missing Plan B", async () => {
    await service.from("student_career_intent").upsert({ student_id: userId, primary_career_id: careerA.id, secondary_career_id: null, is_exploring: false });
    expect((await loadDomainSet(service, userId, "plan-b")).state).toBe("no_plan_b");
  });
});

describe("stream pool", () => {
  it("serves PUBLISHED content for the branch (explicit or legacy scope) and never drafts", async () => {
    const explicit = await insertChallenge({ track: "stream", status: "PUBLISHED", branch_keys: ["zz branch"], scope_key: "other" });
    const legacy = await insertChallenge({ track: "stream", status: "PUBLISHED", scope_key: SCOPE });
    const draft = await insertChallenge({ track: "stream", status: "DRAFT", branch_keys: ["zz branch"] });
    const pool = await loadStreamPool(service, { scopeKey: SCOPE, branchKey: "zz branch" });
    expect(pool.map((c) => c.id).sort()).toEqual([explicit, legacy].sort());
    expect(pool.map((c) => c.id)).not.toContain(draft);
    expect((await loadStreamPool(service, { scopeKey: "nothing", branchKey: "another branch" })).length).toBe(0);
  });
});

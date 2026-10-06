import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { createThrowawayUserWithLogin, deleteThrowawayUser, liveServiceClient, signedInClient } from "@/lib/arena-workstations/live-test-helpers";
import { getCareerIntent, proposeCareers, resolveSuggestion, saveCareerIntent } from "./intent";
import { loadCareers } from "./data";
import { loadStudentCapabilities } from "@/lib/capability/read-model";

// Real DB, stubbed AI. Two throwaway students; deleting them cascades their intent and suggestions.
const service = liveServiceClient();
type U = { userId: string; email: string; password: string };
let a: U, b: U;
let da = "", se = "", ml = "";

const stub = (keys: { key: string; confidence: number }[]) => async () => keys;
const ok = <T extends { ok: boolean }>(r: T, label = "") => { expect(r.ok, `${label} ${JSON.stringify(r)}`).toBe(true); return r as Extract<T, { ok: true }>; };

beforeAll(async () => {
  [a, b] = await Promise.all(["a", "b"].map((l) => createThrowawayUserWithLogin(service, `ci-${l}`)));
  const careers = await loadCareers(service);
  const id = (k: string) => careers.find((c) => c.key === k)!.id;
  [da, se, ml] = [id("data-analyst"), id("software-engineer"), id("ai-ml-engineer")];
}, 60_000);
afterAll(async () => { await Promise.all([a, b].map((u) => deleteThrowawayUser(service, u.userId))); });

describe("career catalog (live)", () => {
  it("has the starter careers, every requirement names an ACTIVE skill, and levels are in range", async () => {
    const careers = await loadCareers(service);
    expect(careers.map((c) => c.name)).toEqual(expect.arrayContaining(["Data Analyst", "Data Scientist", "Software Engineer", "Full Stack Developer", "AI/ML Engineer", "Cybersecurity Analyst", "Cloud Engineer", "Product Manager"]));
    const { data: skills } = await service.from("skills").select("id, status");
    const status = new Map((skills ?? []).map((s) => [s.id, s.status]));
    for (const c of careers) {
      expect(c.requirements.length, c.name).toBeGreaterThan(0);
      for (const r of c.requirements) {
        expect(status.get(r.skillId), `${c.name} skill`).toBe("active");
        expect(r.targetLevel).toBeGreaterThanOrEqual(0);
        expect(r.targetLevel).toBeLessThanOrEqual(100);
      }
    }
  });
  it("the database refuses a requirement on a skill that is not active, and the legacy table is untouched", async () => {
    const { data: candidate } = await service.from("skills").select("id").eq("status", "candidate").limit(1).single();
    const r = await service.from("career_skill_requirements").insert({ career_id: da, skill_id: candidate!.id, importance: "LOW", target_level: 10 });
    expect(r.error?.message).toMatch(/active skill/);
    expect((await service.from("career_requirements").select("id", { count: "exact", head: true })).count).toBe(5);
  });
  it("anyone can read the catalog but no browser client can change it; a student cannot touch intent or suggestions directly", async () => {
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
    expect(((await anon.from("careers").select("id").limit(1)).data ?? []).length).toBe(1);
    expect((await anon.from("careers").update({ is_active: false }).eq("id", da)).error).not.toBeNull();
    expect((await anon.from("career_skill_requirements").delete().eq("career_id", da)).error).not.toBeNull();
    const asA = await signedInClient(a.email, a.password);
    expect((await asA.from("student_career_intent").insert({ student_id: a.userId, primary_career_id: da })).error).not.toBeNull();
    expect((await asA.from("career_suggestions").insert({ student_id: a.userId, source_text: "hello there", suggested_career_ids: [da] })).error).not.toBeNull();
    expect((await asA.from("careers").update({ name: "Hacked" }).eq("id", da)).error).not.toBeNull();
  });
});

describe("career intent (live)", () => {
  it("saves a main career, a Plan B and exploring; partial updates keep the rest; no main career drops Plan B", async () => {
    ok(await saveCareerIntent(service, a.userId, { primaryCareerId: da }));
    ok(await saveCareerIntent(service, a.userId, { secondaryCareerId: se }));
    let i = (await getCareerIntent(service, a.userId)).intent;
    expect([i.primary?.name, i.secondary?.name, i.isExploring]).toEqual(["Data Analyst", "Software Engineer", false]);
    ok(await saveCareerIntent(service, a.userId, { isExploring: true }));
    i = (await getCareerIntent(service, a.userId)).intent;
    expect([i.primary?.name, i.secondary?.name, i.isExploring]).toEqual(["Data Analyst", "Software Engineer", true]);
    ok(await saveCareerIntent(service, a.userId, { primaryCareerId: null }));
    i = (await getCareerIntent(service, a.userId)).intent;
    expect([i.primary, i.secondary]).toEqual([null, null]);
  });
  it("refuses a Plan B without a main career, the same career twice, and unknown or inactive careers", async () => {
    await service.from("student_career_intent").delete().eq("student_id", b.userId);
    expect(await saveCareerIntent(service, b.userId, { secondaryCareerId: se })).toMatchObject({ ok: false, status: 400 });
    expect(await saveCareerIntent(service, b.userId, { primaryCareerId: da, secondaryCareerId: da })).toMatchObject({ ok: false, status: 400 });
    expect(await saveCareerIntent(service, b.userId, { primaryCareerId: "00000000-0000-0000-0000-000000000000" })).toMatchObject({ ok: false, status: 400 });
  });
  it("one student's choices never touch another's", async () => {
    ok(await saveCareerIntent(service, b.userId, { primaryCareerId: ml }));
    ok(await saveCareerIntent(service, a.userId, { primaryCareerId: se }));
    expect((await getCareerIntent(service, b.userId)).intent.primary?.name).toBe("AI/ML Engineer");
    expect((await getCareerIntent(service, a.userId)).intent.primary?.name).toBe("Software Engineer");
  });
});

describe("free-text goals become suggestions, never decisions (live, stubbed AI)", () => {
  it("stores a PENDING suggestion and the student's words, and leaves their chosen careers alone", async () => {
    ok(await saveCareerIntent(service, a.userId, { primaryCareerId: se, secondaryCareerId: null }));
    const r = ok(await proposeCareers(service, a.userId, "I love working with data and building dashboards", stub([{ key: "data-analyst", confidence: 0.9 }, { key: "bogus", confidence: 0.8 }, { key: "data-scientist", confidence: 0.6 }])));
    expect(r.suggestion!.careers.map((c) => c.name)).toEqual(["Data Analyst", "Data Scientist"]); // a key outside the catalog is dropped
    const s = await getCareerIntent(service, a.userId);
    expect(s.intent.primary?.name).toBe("Software Engineer"); // NOT overwritten
    expect(s.intent.goalText).toBe("I love working with data and building dashboards");
    expect(s.intent.goalConfidence).toBe(0.9);
    expect(s.suggestions).toHaveLength(1);
  });
  it("a new interpretation supersedes the pending one; nothing fitting still keeps the student's words", async () => {
    ok(await proposeCareers(service, a.userId, "Maybe something with cloud servers", stub([{ key: "cloud-engineer", confidence: 0.7 }])));
    expect((await getCareerIntent(service, a.userId)).suggestions).toHaveLength(1);
    const none = ok(await proposeCareers(service, a.userId, "I want to be a professional astronaut", stub([])));
    expect(none.suggestion).toBeNull();
    const s = await getCareerIntent(service, a.userId);
    expect(s.suggestions).toHaveLength(0);
    expect(s.intent.goalText).toBe("I want to be a professional astronaut");
    expect(s.intent.primary?.name).toBe("Software Engineer");
  });
  it("an AI failure is a clear message and changes nothing", async () => {
    const before = await getCareerIntent(service, a.userId);
    const r = await proposeCareers(service, a.userId, "something unclear here", async () => { throw new Error("model down"); });
    expect(r).toMatchObject({ ok: false, status: 503 });
    expect(await getCareerIntent(service, a.userId)).toEqual(before);
  });
  it("accepting sets exactly the chosen career (as main or Plan B); a career that was not suggested is refused; answering twice is refused", async () => {
    const r = ok(await proposeCareers(service, b.userId, "data and machine learning", stub([{ key: "data-analyst", confidence: 0.8 }, { key: "ai-ml-engineer", confidence: 0.7 }])));
    const id = r.suggestion!.id;
    expect(await resolveSuggestion(service, b.userId, id, { action: "accept", careerId: se })).toMatchObject({ ok: false, status: 400 });
    expect((await getCareerIntent(service, b.userId)).intent.secondary).toBeNull();
    ok(await resolveSuggestion(service, b.userId, id, { action: "accept", careerId: da, as: "secondary" }));
    const i = (await getCareerIntent(service, b.userId)).intent;
    expect([i.primary?.name, i.secondary?.name]).toEqual(["AI/ML Engineer", "Data Analyst"]);
    expect(await resolveSuggestion(service, b.userId, id, { action: "dismiss" })).toMatchObject({ ok: false, status: 409 });
    expect((await getCareerIntent(service, b.userId)).suggestions).toHaveLength(0);
  });
  it("dismissing changes no career; another student's suggestion is not found", async () => {
    const r = ok(await proposeCareers(service, a.userId, "software and cloud", stub([{ key: "cloud-engineer", confidence: 0.6 }])));
    expect(await resolveSuggestion(service, b.userId, r.suggestion!.id, { action: "accept", careerId: r.suggestion!.careers[0].id })).toMatchObject({ ok: false, status: 404 });
    ok(await resolveSuggestion(service, a.userId, r.suggestion!.id, { action: "dismiss" }));
    expect((await getCareerIntent(service, a.userId)).intent.primary?.name).toBe("Software Engineer");
  });
});

describe("capability read model (live)", () => {
  it("expresses existing capability rows and Arena ratings per canonical skill, and lists what it could not match", async () => {
    await service.from("capabilities").insert([
      { user_id: a.userId, skill: "Python Programming", domain: "Programming", capability_score: 70, confidence: "high", data_points: 6 },
      { user_id: a.userId, skill: "Totally Unknown Skill Name Zz", domain: "x", capability_score: 50, confidence: "low", data_points: 1 },
    ]);
    await service.from("capability_history").insert({ user_id: a.userId, skill: "Python Programming", capability_score: 70, confidence: "high", source: "project" });
    await service.from("arena_skill_ratings").insert({ user_id: a.userId, role_key: "data-analyst", area_key: "sql", rating: 450, verified_count: 2 });
    const caps = await loadStudentCapabilities(service, a.userId);
    const { data: skills } = await service.from("skills").select("id, key").in("key", ["SKILL_PYTHON", "SKILL_SQL"]);
    const id = (k: string) => skills!.find((s) => s.key === k)!.id;
    expect(caps.bySkill.get(id("SKILL_PYTHON"))).toMatchObject({ level: 70, verified: true, confidence: 0.9, breakdown: { PROJECT: 1 } });
    expect(caps.bySkill.get(id("SKILL_SQL"))).toMatchObject({ level: 50, verified: true, confidence: 0.7, breakdown: { ARENA: 1 } }); // 2 verified tasks x 25
    expect(caps.unmatched).toEqual(["Totally Unknown Skill Name Zz"]);
    expect(caps.bySkill.size).toBe(2);
    expect((await loadStudentCapabilities(service, b.userId)).bySkill.size).toBe(0); // nothing for a student with no evidence
  });
});

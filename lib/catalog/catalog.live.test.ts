import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { createThrowawayUserWithLogin, deleteThrowawayUser, liveServiceClient } from "@/lib/arena-workstations/live-test-helpers";
import { applySeed, validateSeed } from "../../scripts/lib/catalog-seed.mjs";
import { loadArenaChallengesForSkills, loadCertifications, loadLearningCatalog, loadProjects, MAX_AI_RECOMMENDATIONS_PER_STUDENT, saveAiProjectRecommendation } from "./data";
import { recommendArena, recommendCertifications, recommendLearning, recommendProjects } from "./match";
import { loadCareers } from "@/lib/careers/data";

// Real DB. Fixtures are named ZZ-Catalog-<stamp> and removed afterwards; the operator-curated rows are never touched.
const service = liveServiceClient();
const stamp = Date.now();
const P = `ZZ-Catalog-${stamp}`;
let a: { userId: string }, b: { userId: string };
let sqlId = "", graphId = "", daId = "";
let tempChallenge = "";

const seedFile = (over: Record<string, unknown> = {}) => ({
  certifications: [{ name: `${P} Cert`, provider: P, difficulty: "BEGINNER", url: "https://example.com/cert", skills: ["SKILL_SQL"], careers: [{ career: "data-analyst", relevance: "REQUIRED" }] }],
  learning: [{ title: `${P} Course`, provider: P, url: "https://example.com/c", levelFrom: 0, levelTo: 60, estimatedHours: 12, skills: ["SKILL_SQL"] }],
  projects: [{ title: `${P} Project`, description: "Build a thing", difficulty: "BEGINNER", expectedEvidence: ["a link"], source: "CAPABILIO", skills: ["SKILL_SQL"] }],
  ...over,
});
/** A seed that must validate; throws with the problems otherwise so a bad fixture fails loudly. */
function seedOf(file: unknown) {
  const v = validateSeed(file);
  if (!v.ok) throw new Error(`fixture invalid: ${(v.problems ?? []).join("; ")}`);
  return v.seed;
}
const count = async (table: string, col: string, val: string) => (await service.from(table as never).select("*", { count: "exact", head: true }).eq(col, val)).count ?? 0;

beforeAll(async () => {
  [a, b] = await Promise.all(["a", "b"].map((l) => createThrowawayUserWithLogin(service, `cat-${l}`)));
  const { data: skills } = await service.from("skills").select("id, key").in("key", ["SKILL_SQL", "SKILL_GRAPH_ALGORITHMS"]);
  sqlId = skills!.find((s) => s.key === "SKILL_SQL")!.id;
  graphId = skills!.find((s) => s.key === "SKILL_GRAPH_ALGORITHMS")!.id;
  daId = (await loadCareers(service)).find((c) => c.key === "data-analyst")!.id;
}, 60_000);

afterAll(async () => {
  await service.from("certification_catalog").delete().eq("provider", P);
  await service.from("learning_catalog").delete().eq("provider", P);
  await service.from("project_catalog").delete().like("title", `${P}%`);
  if (tempChallenge) await service.from("arena_challenges").delete().eq("id", tempChallenge);
  await Promise.all([a, b].map((u) => deleteThrowawayUser(service, u.userId)));
});

describe("operator seed path (live)", () => {
  it("validates the file before touching the database", () => {
    expect(validateSeed(seedFile()).ok).toBe(true);
    const bad = validateSeed(seedFile({ certifications: [{ name: "x", provider: "y", url: "http://insecure.example", skills: ["SKILL_SQL"], careers: [{ career: "data-analyst", relevance: "REQUIRED" }] }] }));
    expect(bad).toMatchObject({ ok: false });
    expect(validateSeed(seedFile({ learning: [{ title: "x", provider: "y", levelFrom: 50, levelTo: 50, skills: ["SKILL_SQL"] }] }))).toMatchObject({ ok: false });
    expect(validateSeed({ projects: [{ title: "x", description: "d", difficulty: "BEGINNER", source: "AI_GENERATED", skills: ["SKILL_SQL"] }] })).toMatchObject({ ok: false }); // AI projects are never seeded
    expect(validateSeed({ projects: [{ title: "x", description: "d", difficulty: "BEGINNER", source: "COLLEGE", skills: ["SKILL_SQL"] }] })).toMatchObject({ ok: false });
    expect(validateSeed({ surprise: 1 })).toMatchObject({ ok: false });
    const dup = validateSeed(seedFile({ learning: [seedFile().learning[0], seedFile().learning[0]] }));
    expect(dup).toMatchObject({ ok: false, problems: [expect.stringMatching(/duplicate learning/)] });
  });

  it("an unknown skill or career key stops the whole run before anything is written", async () => {
    const r1 = await applySeed(service, seedOf(seedFile({ learning: [{ title: `${P} Bad`, provider: P, levelFrom: 0, levelTo: 50, skills: ["SKILL_NOPE"] }] })));
    expect(r1).toMatchObject({ ok: false, problems: [expect.stringMatching(/SKILL_NOPE/)] });
    expect(await applySeed(service, seedOf(seedFile({ certifications: [{ name: `${P} Bad`, provider: P, skills: ["SKILL_SQL"], careers: [{ career: "astronaut", relevance: "REQUIRED" }] }] })))).toMatchObject({ ok: false, problems: [expect.stringMatching(/astronaut/)] });
    expect(await count("learning_catalog", "provider", P)).toBe(0);
    expect(await count("certification_catalog", "provider", P)).toBe(0);
  });

  it("a dry run writes nothing; a real run writes everything, and re-running updates in place", async () => {
    const seed = seedOf(seedFile());
    expect(await applySeed(service, seed, { dryRun: true })).toMatchObject({ ok: true, dryRun: true, counts: { certifications: 1, learning: 1, projects: 1 } });
    expect(await count("certification_catalog", "provider", P)).toBe(0);
    expect(await applySeed(service, seed)).toMatchObject({ ok: true });
    const again = seedOf(seedFile({ learning: [{ title: `${P} Course`, provider: P, levelFrom: 10, levelTo: 80, skills: ["SKILL_SQL", "SKILL_GRAPH_ALGORITHMS"] }] }));
    expect(await applySeed(service, again)).toMatchObject({ ok: true });
    expect(await count("learning_catalog", "provider", P)).toBe(1); // not duplicated
    const item = (await loadLearningCatalog(service)).find((i) => i.provider === P)!;
    expect([item.levelFrom, item.levelTo, item.skillIds.sort()]).toEqual([10, 80, [sqlId, graphId].sort()]);
    expect((await service.from("project_catalog").select("id", { count: "exact", head: true }).eq("title", `${P} Project`)).count).toBe(1);
  });
});

describe("what the roadmap may recommend, from real data (live)", () => {
  it("recommends the configured certification for the career, with the label stored for that career", async () => {
    const certs = await loadCertifications(service);
    const mine = recommendCertifications(daId, [sqlId], certs).find((c) => c.cert.provider === P)!;
    expect(mine).toMatchObject({ relevance: "REQUIRED", coveredSkillIds: [sqlId] });
    expect(mine.cert.difficulty).toBe("BEGINNER");
    // the carried-over curated certifications are there too, honestly unlabelled beyond OPTIONAL and without invented difficulty
    const carried = certs.filter((c) => ["Microsoft", "Google"].includes(c.provider));
    expect(carried.length).toBeGreaterThanOrEqual(2);
    expect(carried.every((c) => c.difficulty === null && c.cost === null)).toBe(true);
  });
  it("learning resources and projects come only from what is configured", async () => {
    expect(recommendLearning(sqlId, 0, 80, await loadLearningCatalog(service)).some((r) => r.item.provider === P)).toBe(true);
    expect(recommendLearning("00000000-0000-0000-0000-000000000000", 0, 80, await loadLearningCatalog(service))).toEqual([]);
    const projects = recommendProjects([sqlId], await loadProjects(service, { studentId: a.userId, institutionId: null }), { studentId: a.userId, institutionId: null });
    expect(projects.some((p) => p.project.title === `${P} Project`)).toBe(true);
  });
});

describe("database rules (live)", () => {
  it("an AI project can only be a recommendation for one student; a college project needs a college; no candidate skills; sane ranges and https", async () => {
    const base = { title: `${P} Rule`, description: "d", difficulty: "BEGINNER" };
    const bad = async (row: Record<string, unknown>) => (await service.from("project_catalog").insert({ ...base, ...row } as never)).error?.message ?? "";
    expect(await bad({ source: "AI_GENERATED", status: "ACTIVE", for_student_id: a.userId })).toMatch(/ai_projects_are_recommendations/);
    expect(await bad({ source: "AI_GENERATED", status: "RECOMMENDATION" })).toMatch(/ai_projects_belong_to_a_student/);
    expect(await bad({ source: "CAPABILIO", status: "RECOMMENDATION" })).toMatch(/ai_projects_are_recommendations/);
    expect(await bad({ source: "COLLEGE", status: "ACTIVE" })).toMatch(/college_projects_belong_to_a_college/);
    expect(await bad({ source: "CAPABILIO", status: "ACTIVE", for_student_id: a.userId })).toMatch(/ai_projects_belong_to_a_student/);
    const { data: candidate } = await service.from("skills").select("id").eq("status", "candidate").limit(1).single();
    const { data: item } = await service.from("learning_catalog").select("id").eq("provider", P).single();
    expect((await service.from("learning_item_skills").insert({ item_id: item!.id, skill_id: candidate!.id })).error?.message).toMatch(/active skill/);
    expect((await service.from("learning_catalog").insert({ title: `${P} Range`, provider: P, level_from: 50, level_to: 40 })).error?.message).toMatch(/level_to|check/i);
    expect((await service.from("certification_catalog").insert({ name: `${P} Http`, provider: P, url: "http://x.example" })).error).not.toBeNull();
  });

  it("anyone can read active catalog items but not write; drafts and other students' AI recommendations stay private", async () => {
    await service.from("project_catalog").insert({ title: `${P} Draft`, description: "d", difficulty: "BEGINNER", source: "CAPABILIO", status: "DRAFT" });
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
    expect(((await anon.from("certification_catalog").select("id").eq("provider", P)).data ?? []).length).toBe(1);
    const visibleProjects = (await anon.from("project_catalog").select("title").like("title", `${P}%`)).data ?? [];
    expect(visibleProjects.map((p) => p.title)).toEqual([`${P} Project`]); // the draft is not public
    expect((await anon.from("learning_catalog").update({ title: "x" }).eq("provider", P)).error).not.toBeNull();
    expect((await anon.from("project_catalog").insert({ title: "x", description: "d", difficulty: "BEGINNER", source: "CAPABILIO", status: "ACTIVE" })).error).not.toBeNull();
    expect((await anon.from("arena_challenge_skills").insert({ challenge_id: "00000000-0000-0000-0000-000000000000", skill_id: sqlId, source: "TAG" })).error).not.toBeNull();
  });
});

describe("AI project recommendations (live)", () => {
  it("are stored as a recommendation for exactly one student, never public, and capped", async () => {
    const r = await saveAiProjectRecommendation(service, a.userId, { title: `${P} AI Idea`, description: "Try this", difficulty: "BEGINNER", expectedEvidence: ["a repo"], skillIds: [sqlId] });
    expect(r.ok).toBe(true);
    const mine = await loadProjects(service, { studentId: a.userId, institutionId: null });
    const theirs = await loadProjects(service, { studentId: b.userId, institutionId: null });
    expect(mine.find((p) => p.title === `${P} AI Idea`)).toMatchObject({ source: "AI_GENERATED", status: "RECOMMENDATION", forStudentId: a.userId });
    expect(theirs.some((p) => p.title === `${P} AI Idea`)).toBe(false);
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
    expect(((await anon.from("project_catalog").select("id").eq("title", `${P} AI Idea`)).data ?? []).length).toBe(0);
    expect(recommendProjects([sqlId], theirs, { studentId: b.userId, institutionId: null }).some((p) => p.isAiRecommendation)).toBe(false);
    // the cap
    for (let i = 0; i < MAX_AI_RECOMMENDATIONS_PER_STUDENT; i++) await saveAiProjectRecommendation(service, b.userId, { title: `${P} Cap ${i}`, description: "d", difficulty: "BEGINNER", expectedEvidence: [], skillIds: [] });
    expect(await saveAiProjectRecommendation(service, b.userId, { title: `${P} Cap over`, description: "d", difficulty: "BEGINNER", expectedEvidence: [], skillIds: [] })).toMatchObject({ ok: false, status: 409 });
    // skills outside the catalog are refused and leave nothing behind
    const { data: candidate } = await service.from("skills").select("id").eq("status", "candidate").limit(1).single();
    expect(await saveAiProjectRecommendation(service, a.userId, { title: `${P} Bad skill`, description: "d", difficulty: "BEGINNER", expectedEvidence: [], skillIds: [candidate!.id] })).toMatchObject({ ok: false, status: 400 });
    expect(await count("project_catalog", "title", `${P} Bad skill`)).toBe(0);
  }, 120_000);
});

describe("Arena challenges are tagged with canonical skills in the database (live)", () => {
  it("existing challenges carry canonical tags, derived only from exact matches", async () => {
    const { count: tagged } = await service.from("arena_challenge_skills").select("challenge_id", { count: "exact", head: true });
    expect(tagged ?? 0).toBeGreaterThan(20);
    const { data: rows } = await service.from("arena_challenge_skills").select("skill_id, source");
    const { data: skills } = await service.from("skills").select("id, status").in("id", [...new Set((rows ?? []).map((r) => r.skill_id))]);
    expect((skills ?? []).every((s) => s.status === "active")).toBe(true);
    expect(recommendArena([graphId], await loadArenaChallengesForSkills(service, [graphId]), "medium").length).toBeGreaterThan(0);
  });

  it("a new challenge is tagged automatically, a changed tag list is re-derived, and unknown tags are ignored", async () => {
    const { data: tpl } = await service.from("arena_challenges").select("*").limit(1).single();
    const { id: _id, created_at: _c, ...rest } = tpl as Record<string, unknown>;
    const ins = await service.from("arena_challenges").insert({ ...rest, title: `${P} challenge`, scope_key: `zz-${stamp}`, sequence: 1, skill_area_key: null, skill_tags: ["DFS", "Totally Unknown Tag Zz"] } as never).select("id").single();
    expect(ins.error?.message ?? "").toBe("");
    tempChallenge = ins.data!.id;
    const tags = async () => ((await service.from("arena_challenge_skills").select("skill_id, source").eq("challenge_id", tempChallenge)).data ?? []);
    expect(await tags()).toEqual([{ skill_id: graphId, source: "TAG" }]);
    await service.from("arena_challenges").update({ skill_tags: ["SQL", "joins"] }).eq("id", tempChallenge);
    expect((await tags()).map((t) => t.skill_id)).toEqual([sqlId]); // both tags -> SQL, once
    await service.from("arena_challenges").update({ skill_tags: [] }).eq("id", tempChallenge);
    expect(await tags()).toEqual([]);
  });
});

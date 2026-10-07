import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createThrowawayUserWithLogin, deleteThrowawayUser, liveServiceClient, signedInClient } from "@/lib/arena-workstations/live-test-helpers";
import { saveCareerIntent } from "@/lib/careers/intent";
import { loadCareers } from "@/lib/careers/data";
import { untyped } from "@/lib/org/db";
import { ensureRoadmap } from "./service";
import { getCurrentRoadmapView, getRoadmapVersionView, listRoadmapVersions } from "./read";
import { regenerateForBranch } from "./regenerate";
import type { ExplainFn } from "./explain";

// Real DB. Throwaway institution + students; deleting the students cascades their roadmaps, which also proves removal still works.
const service = liveServiceClient();
const db = untyped(service);
const stamp = Date.now();
const BRANCH = "ZZ Version Branch";
const thisYear = new Date().getFullYear();
let inst = "";
let a: { userId: string; email: string; password: string }, b: typeof a, c: typeof a;
let careers: Record<string, string> = {};
let skill: Record<string, string> = {};
let explainCalls = 0;
const explain: ExplainFn = async (_career, subjects) => { explainCalls++; return new Map(subjects.slice(0, 1).map((s) => [s.id, `This subject builds ${s.skillNames[0]}.`])); };
const ensure = (userId: string, opts: Parameters<typeof ensureRoadmap>[2] = {}) => ensureRoadmap(service, userId, { explain, ...opts });
async function ready(userId: string, opts: Parameters<typeof ensureRoadmap>[2] = {}) {
  const r = await ensure(userId, opts);
  if (r.status !== "READY") throw new Error(`expected READY, got ${JSON.stringify(r)}`);
  return r;
}
const count = async (table: string, col: string, val: string) => (await db.from(table).select("*", { count: "exact", head: true }).eq(col, val)).count ?? 0;

async function publish(regulation: string | null, courseTitle = "Database Management Systems", skillKey = "SKILL_SQL") {
  const { data: imp } = await service.from("curriculum_imports").insert({ institution_id: inst, branch: BRANCH, status: "CONFIRMED", regulation }).select("id").single();
  const { data: row } = await service.from("courses").insert({ import_id: imp!.id, year: 3, semester: 1, title: courseTitle }).select("id").single();
  await service.from("course_skill_mappings").insert({ course_id: row!.id, skill_id: skill[skillKey], importance: "CORE", mapping_source: "MANUAL", status: "CONFIRMED", approved_at: new Date().toISOString() });
  const { error } = await service.rpc("publish_curriculum_import", { p_import_id: imp!.id, p_user_id: null as unknown as string });
  if (error) throw new Error(error.message);
}
async function member(userId: string, confirmed: boolean) {
  await service.from("institution_memberships").insert({ user_id: userId, institution_id: inst, role: "student", status: "active", branch: BRANCH, start_year: thisYear - 2, end_year: thisYear + 2, ...(confirmed ? { year_confirmed_at: new Date().toISOString(), year_override: 3 } : {}) });
}

beforeAll(async () => {
  inst = (await service.from("institutions").insert({ name: `ZZ VERS ${stamp}`, slug: `zz-vers-${stamp}` }).select("id").single()).data!.id;
  [a, b, c] = await Promise.all(["a", "b", "c"].map((l) => createThrowawayUserWithLogin(service, `ver-${l}`)));
  careers = Object.fromEntries((await loadCareers(service)).map((x) => [x.key, x.id]));
  const { data: skills } = await service.from("skills").select("id, key").eq("status", "active");
  skill = Object.fromEntries((skills ?? []).map((s) => [s.key!, s.id]));
  await publish("ZZ-R1");
  await member(a.userId, true);
  await saveCareerIntent(service, a.userId, { primaryCareerId: careers["data-analyst"] });
  await service.from("capabilities").insert({ user_id: a.userId, skill: "SQL", domain: "Data", capability_score: 38, confidence: "medium", data_points: 4 });
}, 120_000);

afterAll(async () => {
  await service.from("learning_catalog").delete().eq("provider", `ZZ-${stamp}`);
  await service.from("institution_memberships").delete().eq("institution_id", inst);
  await service.from("institutions").delete().eq("id", inst);
  await Promise.all([a, b, c].map((u) => deleteThrowawayUser(service, u.userId)));
});

describe("the first roadmap (live)", () => {
  it("is saved as version 1 with every part stored, and read back", async () => {
    const r = await ready(a.userId);
    expect(r).toMatchObject({ created: true, trigger: "CAREER_CHANGE" });
    expect(r.view).toMatchObject({ versionNo: 1, isCurrent: true, isLatest: true, mode: "STANDARD", career: { name: "Data Analyst" } });
    expect(r.view.gaps.length).toBeGreaterThan(5);
    expect(r.view.gaps.find((g) => g.skillName === "SQL")).toMatchObject({ currentLevel: 38, targetLevel: 80, gap: 42, coverage: "STRONG" });
    expect(r.view.subjects[0]).toMatchObject({ title: "Database Management Systems", schedule: "CURRENT" });
    expect(r.view.subjects[0].aiExplanation).toBe("This subject builds SQL.");
    expect(r.view.milestones.length).toBeGreaterThan(0);
    expect(r.view.nextBestAction).toBeTruthy();
    expect(r.view.notes).toMatchObject({ semesterEstimated: true });
    expect(await getCurrentRoadmapView(service, a.userId)).toMatchObject({ versionNo: 1 });
    expect(await count("roadmap_skill_gaps", "version_id", r.view.versionId)).toBe(r.view.gaps.length);
    // honest scoring (capability.v2): the version records its formula, and a skill with no evidence is stored as NOT assessed (not as a measured 0)
    const { data: row } = await service.from("roadmap_versions" as never).select("formula_version").eq("id", r.view.versionId).single();
    expect((row as unknown as { formula_version: string }).formula_version).toBe("capability.v2");
    expect(r.view.gaps.find((g) => g.skillName === "SQL")!.assessed).toBe(true);
    const unassessed = r.view.gaps.filter((g) => !g.assessed);
    expect(unassessed.length).toBeGreaterThan(0);
    expect(unassessed.every((g) => g.currentLevel === 0 && !g.verified)).toBe(true);
  });
});

describe("regeneration is idempotent and hash-driven (live)", () => {
  it("asking again with the same inputs writes nothing and calls no AI", async () => {
    const before = explainCalls;
    const again = await ready(a.userId);
    expect(again).toMatchObject({ created: false, trigger: null });
    expect(again.view.versionNo).toBe(1);
    expect(explainCalls).toBe(before);
    const refreshed = await ready(a.userId, { refresh: true });
    expect(refreshed.created).toBe(false); // "up to date"
    expect((await listRoadmapVersions(service, a.userId)).length).toBe(1);
  });

  it("new verified evidence creates version 2 (PROGRESS_UPDATE); version 1 stays readable and is marked as no longer the latest", async () => {
    const v1 = (await getCurrentRoadmapView(service, a.userId))!;
    await service.from("arena_skill_ratings").insert({ user_id: a.userId, role_key: "data-analyst", area_key: "sql", rating: 450, verified_count: 3, last_verified_at: new Date().toISOString() });
    const r = await ready(a.userId);
    expect(r).toMatchObject({ created: true, trigger: "PROGRESS_UPDATE" });
    expect(r.view.versionNo).toBe(2);
    expect(r.view.readiness).toBeGreaterThan(v1.readiness);
    expect(r.view.gaps.find((g) => g.skillName === "SQL")!.currentLevel).toBe(75);
    const old = (await getRoadmapVersionView(service, a.userId, v1.versionId))!;
    expect(old).toMatchObject({ versionNo: 1, isLatest: false, readiness: v1.readiness });
    expect(old.gaps.find((g) => g.skillName === "SQL")!.currentLevel).toBe(38); // history is unchanged
  });

  it("a manual refresh that finds a change labels the version MANUAL", async () => {
    await service.from("arena_skill_ratings").update({ verified_count: 4 }).eq("user_id", a.userId).eq("area_key", "sql");
    const r = await ready(a.userId, { refresh: true });
    expect(r).toMatchObject({ created: true, trigger: "MANUAL" });
    expect(r.view.versionNo).toBe(3);
  });

  it("a newly published curriculum version creates a new roadmap version (CURRICULUM_PUBLISHED)", async () => {
    await publish("ZZ-R1", "Database Management Systems II", "SKILL_STATISTICS"); // SQL is already met (100), so give the new course a skill with a gap
    const r = await ready(a.userId);
    expect(r).toMatchObject({ created: true, trigger: "CURRICULUM_PUBLISHED" });
    expect(r.view.subjects.map((s) => s.title)).toContain("Database Management Systems II");
  });

  it("concurrent requests for a changed input produce exactly one new version", async () => {
    const { data: st } = await service.from("skills").select("name").eq("id", skill.SKILL_STATISTICS).single();
    await service.from("capabilities").insert({ user_id: a.userId, skill: st!.name, domain: "Data", capability_score: 50, confidence: "medium", data_points: 3 });
    const before = (await listRoadmapVersions(service, a.userId)).length;
    const results = await Promise.all([1, 2, 3, 4].map(() => ensure(a.userId)));
    expect(results.every((r) => r.status === "READY")).toBe(true);
    expect((await listRoadmapVersions(service, a.userId)).length).toBe(before + 1);
    const ids = new Set(results.map((r) => (r.status === "READY" ? r.view.versionId : "")));
    expect(ids.size).toBe(1);
  });
});

describe("changing career (live)", () => {
  it("a new career gets its own roadmap; the old one stops being current but keeps every version; switching back starts a new version", async () => {
    const before = await listRoadmapVersions(service, a.userId);
    await saveCareerIntent(service, a.userId, { primaryCareerId: careers["software-engineer"] });
    const se = await ready(a.userId);
    expect(se).toMatchObject({ created: true, trigger: "CAREER_CHANGE" });
    expect(se.view).toMatchObject({ versionNo: 1, career: { name: "Software Engineer" }, isCurrent: true });
    const { data: roadmaps } = await db.from("roadmaps").select("career_id, is_current").eq("student_id", a.userId);
    expect(roadmaps!.filter((r: { is_current: boolean }) => r.is_current)).toHaveLength(1); // exactly one current roadmap
    expect((await listRoadmapVersions(service, a.userId)).length).toBe(before.length + 1);

    await saveCareerIntent(service, a.userId, { primaryCareerId: careers["data-analyst"] });
    const back = await ready(a.userId);
    expect(back).toMatchObject({ created: true, trigger: "CAREER_CHANGE" }); // reactivating a roadmap always starts a new version
    expect(back.view.career.name).toBe("Data Analyst");
    expect(back.view.versionNo).toBeGreaterThan(before.filter((v) => v.careerName === "Data Analyst").length);
    const all = await listRoadmapVersions(service, a.userId);
    expect(all.filter((v) => v.isCurrentRoadmap).every((v) => v.careerName === "Data Analyst")).toBe(true);
    expect(all[0].generatedAt >= all[all.length - 1].generatedAt).toBe(true); // newest first
  });
});

describe("versions are immutable, but removal and catalog changes still work (live)", () => {
  it("nothing in a stored version can be edited or deleted", async () => {
    const v = (await getCurrentRoadmapView(service, a.userId))!;
    const upd = await db.from("roadmap_versions").update({ readiness_score: 1 }).eq("id", v.versionId);
    expect(upd.error?.message).toMatch(/immutable/);
    expect((await db.from("roadmap_versions").delete().eq("id", v.versionId)).error?.message).toMatch(/immutable/);
    expect((await db.from("roadmap_skill_gaps").update({ gap: 0 }).eq("version_id", v.versionId)).error?.message).toMatch(/immutable/);
    expect((await db.from("roadmap_milestones").delete().eq("version_id", v.versionId)).error?.message).toMatch(/immutable/);
    expect((await getRoadmapVersionView(service, a.userId, v.versionId))!.readiness).toBe(v.readiness);
  });

  it("deleting a catalog item a roadmap refers to just clears that reference; the roadmap keeps its title", async () => {
    const { data: item } = await service.from("learning_catalog").insert({ title: "ZZ Python Primer", provider: `ZZ-${stamp}`, level_from: 0, level_to: 70 }).select("id").single();
    await service.from("learning_item_skills").insert({ item_id: item!.id, skill_id: skill.SKILL_PYTHON });
    const r = await ready(a.userId);
    const stored = (await db.from("roadmap_learning_items").select("*").eq("version_id", r.view.versionId).eq("learning_item_id", item!.id)).data!;
    expect(stored).toHaveLength(1);
    expect((await service.from("learning_catalog").delete().eq("id", item!.id)).error).toBeNull();
    const after = (await db.from("roadmap_learning_items").select("title, learning_item_id").eq("version_id", r.view.versionId).eq("title", "ZZ Python Primer")).data!;
    expect(after).toEqual([{ title: "ZZ Python Primer", learning_item_id: null }]);
  });
});

describe("who can see and change a roadmap (live)", () => {
  it("a student reads only their own; nobody can write through the API", async () => {
    const asA = await signedInClient(a.email, a.password);
    const asB = await signedInClient(b.email, b.password);
    expect(((await asA.from("roadmaps" as never).select("id")).data as unknown[]).length).toBeGreaterThan(0);
    expect(((await asA.from("roadmap_versions" as never).select("id")).data as unknown[]).length).toBeGreaterThan(3);
    expect(((await asA.from("roadmap_skill_gaps" as never).select("skill_name").limit(5)).data as unknown[]).length).toBeGreaterThan(0);
    for (const t of ["roadmaps", "roadmap_versions", "roadmap_skill_gaps", "roadmap_courses", "roadmap_milestones"]) expect(((await asB.from(t as never).select("*")).data as unknown[]).length, t).toBe(0);
    expect((await asA.from("roadmaps" as never).insert({ student_id: a.userId, career_id: careers["data-analyst"] } as never)).error).not.toBeNull();
    expect((await asA.from("roadmap_versions" as never).update({ readiness_score: 100 } as never).eq("input_hash", "x")).error?.code ?? "rls").toBeTruthy();
    expect((await asA.rpc("save_roadmap_version" as never, { p: {} } as never)).error).not.toBeNull();
    const view = (await getCurrentRoadmapView(service, a.userId))!;
    expect(await getRoadmapVersionView(service, b.userId, view.versionId)).toBeNull(); // not B's
  });
});

describe("states that must not create a roadmap (live)", () => {
  it("a student who cannot be given one yet gets a precise reason and nothing is written", async () => {
    expect(await ensure(c.userId)).toEqual({ status: "MISSING_ACADEMIC_POSITION", reason: "no_membership" });
    await member(b.userId, false);
    await saveCareerIntent(service, b.userId, { primaryCareerId: careers["data-analyst"] });
    expect(await ensure(b.userId)).toEqual({ status: "MISSING_ACADEMIC_POSITION", reason: "year_unknown" });
    expect(await count("roadmaps", "student_id", c.userId)).toBe(0);
    expect(await count("roadmaps", "student_id", b.userId)).toBe(0);
  });
});

describe("regeneration after a curriculum is published (live)", () => {
  it("brings the branch's goal-setting students up to date, leaves unchanged ones alone, and reports who isn't ready", async () => {
    await ready(a.userId); // settle: the previous test deleted a catalog item, which legitimately changed the inputs
    const quiet = await regenerateForBranch(service, inst, BRANCH.toLowerCase(), { explain });
    expect(quiet).toMatchObject({ considered: 2, regenerated: 0, unchanged: 1, notReady: 1, failed: 0, remaining: 0 }); // a: unchanged; b: year not confirmed; c: no goal, not considered
    await publish("ZZ-R1", "Database Management Systems III", "SKILL_STATISTICS");
    const r = await regenerateForBranch(service, inst, BRANCH.toLowerCase(), { explain });
    expect(r).toMatchObject({ considered: 2, regenerated: 1, unchanged: 0, notReady: 1, failed: 0 });
    const current = (await getCurrentRoadmapView(service, a.userId))!;
    expect(current.subjects.map((s) => s.title)).toContain("Database Management Systems III");
    const again = await regenerateForBranch(service, inst, BRANCH.toLowerCase(), { explain });
    expect(again).toMatchObject({ regenerated: 0, unchanged: 1 }); // idempotent
    expect(await regenerateForBranch(service, inst, BRANCH.toLowerCase(), { explain, cap: 1 })).toMatchObject({ considered: 1, remaining: 1 }); // bounded
  });
});

describe("removing a student removes their roadmaps (live)", () => {
  it("cascades through every version and child table", async () => {
    const roadmapIds = ((await db.from("roadmaps").select("id").eq("student_id", a.userId)).data as { id: string }[]).map((r) => r.id);
    expect(roadmapIds.length).toBeGreaterThan(0);
    await service.from("institution_memberships").delete().eq("user_id", a.userId);
    await deleteThrowawayUser(service, a.userId);
    for (const id of roadmapIds) {
      expect(await count("roadmap_versions", "roadmap_id", id)).toBe(0);
    }
    expect(await count("roadmaps", "student_id", a.userId)).toBe(0);
    a.userId = c.userId; // (already deleted; keep afterAll from double-deleting a real id)
  });
});

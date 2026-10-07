import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createThrowawayUserWithLogin, deleteThrowawayUser, liveServiceClient } from "@/lib/arena-workstations/live-test-helpers";
import { saveCareerIntent } from "@/lib/careers/intent";
import { loadCareers } from "@/lib/careers/data";
import { prepareRoadmap, type PreparedRoadmap } from "./prepare";
import { estimateSemester } from "./position";
import type { ExplainFn } from "./explain";

// Real DB (existing tables only — nothing here writes a roadmap). Throwaway institution + student; deleted afterwards.
const service = liveServiceClient();
const stamp = Date.now();
let inst = "", userId = "";
let careerIds: Record<string, string> = {};
let skill: Record<string, string> = {};
let dbmsCourse = "";
const BRANCH = "ZZ Roadmap Branch";
const thisYear = new Date().getFullYear();

async function publishCurriculum(regulation: string | null, courses: { title: string; year: number; semester: number; skills: { key: string; importance: "CORE" | "SUPPORTING" | null; ai?: boolean; outcomes?: number }[] }[]) {
  const { data: imp } = await service.from("curriculum_imports").insert({ institution_id: inst, branch: BRANCH, status: "CONFIRMED", regulation }).select("id").single();
  for (const c of courses) {
    const { data: row } = await service.from("courses").insert({ import_id: imp!.id, year: c.year, semester: c.semester, title: c.title }).select("id").single();
    if (/^Database/.test(c.title)) dbmsCourse = row!.id;
    for (const s of c.skills) {
      const common = { skill_id: skill[s.key], mapping_source: s.ai ? "AI_SUGGESTED" : "MANUAL", status: s.ai ? "SUGGESTED" : "CONFIRMED", approved_at: s.ai ? null : new Date().toISOString() };
      await service.from("course_skill_mappings").insert({ course_id: row!.id, importance: s.importance, ...common });
      for (let i = 1; i <= (s.outcomes ?? 0); i++) {
        const { data: co } = await service.from("course_outcomes").insert({ course_id: row!.id, code: `CO${i}`, text: `Outcome ${i} for ${c.title}` }).select("id").single();
        await service.from("course_outcome_skill_mappings").insert({ course_outcome_id: co!.id, course_id: row!.id, ...common });
      }
    }
  }
  const { error } = await service.rpc("publish_curriculum_import", { p_import_id: imp!.id, p_user_id: null as unknown as string });
  if (error) throw new Error(error.message);
  return imp!.id;
}
const ready = async (opts: Parameters<typeof prepareRoadmap>[2] = { explain: false }) => {
  const r = await prepareRoadmap(service, userId, opts);
  if (r.status !== "READY") throw new Error(`expected READY, got ${JSON.stringify(r)}`);
  return r as PreparedRoadmap;
};

beforeAll(async () => {
  inst = (await service.from("institutions").insert({ name: `ZZ PREP ${stamp}`, slug: `zz-prep-${stamp}` }).select("id").single()).data!.id;
  ({ userId } = await createThrowawayUserWithLogin(service, "prep"));
  const careers = await loadCareers(service);
  careerIds = Object.fromEntries(careers.map((c) => [c.key, c.id]));
  const { data: skills } = await service.from("skills").select("id, key").eq("status", "active");
  skill = Object.fromEntries((skills ?? []).map((s) => [s.key!, s.id]));
}, 90_000);

afterAll(async () => {
  await service.from("learning_catalog").delete().eq("provider", `ZZ-${stamp}`);
  await service.from("institution_memberships").delete().eq("institution_id", inst);
  await service.from("institutions").delete().eq("id", inst);
  await deleteThrowawayUser(service, userId);
});

describe("what is missing, in the order a student would fix it (live)", () => {
  it("no membership -> no academic position", async () => {
    expect(await prepareRoadmap(service, userId, { explain: false })).toEqual({ status: "MISSING_ACADEMIC_POSITION", reason: "no_membership" });
  });
  it("an unconfirmed year is not guessed", async () => {
    await service.from("institution_memberships").insert({ user_id: userId, institution_id: inst, role: "student", status: "active", branch: BRANCH, start_year: thisYear - 2, end_year: thisYear + 2 });
    expect(await prepareRoadmap(service, userId, { explain: false })).toEqual({ status: "MISSING_ACADEMIC_POSITION", reason: "year_unknown" });
  });
  it("a confirmed year but no published curriculum -> missing curriculum", async () => {
    await service.from("institution_memberships").update({ year_confirmed_at: new Date().toISOString(), year_override: 3 }).eq("user_id", userId);
    expect(await prepareRoadmap(service, userId, { explain: false })).toEqual({ status: "MISSING_CURRICULUM", reason: "none", regulation: null });
  });
  it("a published curriculum for a DIFFERENT regulation is not used; unknown regulation uses it", async () => {
    await publishCurriculum("ZZ-R1", [{ title: "Database Management Systems", year: 3, semester: 1, skills: [{ key: "SKILL_SQL", importance: "CORE", outcomes: 2 }, { key: "SKILL_BI_DASHBOARDING", importance: "CORE", ai: true }] }, { title: "Probability and Statistics", year: 2, semester: 2, skills: [{ key: "SKILL_STATISTICS", importance: "SUPPORTING" }] }, { title: "Data Visualisation", year: 4, semester: 1, skills: [{ key: "SKILL_BI_DASHBOARDING", importance: "CORE" }] }]);
    await service.from("institution_memberships").update({ regulation: "ZZ-R9" }).eq("user_id", userId);
    expect(await prepareRoadmap(service, userId, { explain: false })).toEqual({ status: "MISSING_CURRICULUM", reason: "regulation", regulation: "ZZ-R9" });
    await service.from("institution_memberships").update({ regulation: "zz-r1" }).eq("user_id", userId); // case-insensitive match
    expect((await prepareRoadmap(service, userId, { explain: false })).status).toBe("MISSING_CAREER_GOAL");
  });
  it("exploring with no chosen career still gets a (lighter) roadmap for the best-matching career", async () => {
    await saveCareerIntent(service, userId, { isExploring: true });
    const r = await ready();
    expect(r.meta.mode).toBe("EXPLORING");
    expect(r.meta.goals[0].kind).toBe("PRIMARY");
    expect(r.meta.goals.length).toBe(3); // the best match plus two alternatives, ranked
    expect(r.meta.goals.slice(1).every((g) => g.kind === "EXPLORING_ALT")).toBe(true);
  });
});

describe("a student with a career goal (live)", () => {
  beforeAll(async () => {
    await saveCareerIntent(service, userId, { primaryCareerId: careerIds["data-analyst"], secondaryCareerId: careerIds["software-engineer"], isExploring: false });
    await service.from("capabilities").insert({ user_id: userId, skill: "SQL", domain: "Data", capability_score: 38, confidence: "medium", data_points: 4 });
  });

  it("assembles the real inputs: official skills only, outcome counts, capability, requirements, position", async () => {
    const r = await ready();
    const { input, meta } = r;
    expect(r.meta.mode).toBe("STANDARD");
    expect(input.career.name).toBe("Data Analyst");
    const sql = input.requirements.find((q) => q.skillId === skill.SKILL_SQL)!;
    expect(sql).toMatchObject({ skillName: "SQL", importance: "CRITICAL", targetLevel: 80, stage: "FOUNDATION" });
    const dbms = input.courses.find((c) => c.title === "Database Management Systems")!;
    expect(dbms.skills).toEqual([{ skillId: skill.SKILL_SQL, importance: "CORE", outcomeCount: 2 }]); // the AI-suggested BI mapping is NOT here
    expect(input.courses.find((c) => c.title === "Data Visualisation")!.skills[0].skillId).toBe(skill.SKILL_BI_DASHBOARDING);
    expect(input.capability[skill.SKILL_SQL]).toMatchObject({ level: 38, verified: true });
    expect(input.hasAnyCapabilityData).toBe(true);
    expect(input.position).toEqual({ year: 3, semester: estimateSemester(new Date(), 7), totalYears: 4 });
    expect(meta.regulation).toBe("ZZ-R1");
    expect(meta.curriculumVersionId).toBeTruthy();
    expect(meta.semesterEstimated).toBe(true);
    expect(meta.goals.map((g) => [g.kind, g.careerName])).toEqual([["PRIMARY", "Data Analyst"], ["PLAN_B", "Software Engineer"]]);
  });

  it("generates a real plan: readiness, ranked subjects, honest catalog notes, a concrete next action", async () => {
    const { plan } = await ready();
    expect(plan.readiness).toBeGreaterThanOrEqual(0);
    expect(plan.readiness).toBeLessThan(100);
    expect(plan.subjects.map((s) => s.title)).toContain("Database Management Systems");
    expect(plan.subjects.find((s) => s.title === "Database Management Systems")).toMatchObject({ schedule: "CURRENT" });
    // The biggest weighted gap is Data Analysis (0 of 80); two Arena challenges are tagged with it, so that is something the student can do today.
    expect(plan.nextBestAction).toMatchObject({ kind: "ARENA", skillId: skill.SKILL_DATA_ANALYSIS, reason: "You haven't been assessed on Data Analysis yet, so we don't know where you are. The target is 80." });
    const sqlGap = plan.gaps.find((g) => g.skillId === skill.SKILL_SQL)!;
    expect(sqlGap).toMatchObject({ currentLevel: 38, targetLevel: 80, gap: 42, coverage: "STRONG", gapType: "COVERED_BY_CURRICULUM" });
    expect(plan.mandatoryNote).toMatch(/remain part of your academic curriculum/);
    // the carried-over curated certifications are configured for Data Analyst, so the note is not "not configured"
    expect(plan.certifications.length).toBeGreaterThan(0);
    expect(plan.certifications.every((c) => c.relevance === "OPTIONAL")).toBe(true);
    expect(plan.projectNote).toMatch(/aren't configured yet|No project/);
    expect(r_gaps(plan).every((g) => g.gap >= 0)).toBe(true);
  });

  it("same inputs -> same hash; new evidence, a new curriculum version or a new career each change it", async () => {
    const a = await ready();
    expect((await ready()).hash).toBe(a.hash);
    await service.from("arena_skill_ratings").insert({ user_id: userId, role_key: "data-analyst", area_key: "sql", rating: 450, verified_count: 3, last_verified_at: new Date().toISOString() });
    const b = await ready();
    expect(b.hash).not.toBe(a.hash);
    expect(b.input.capability[skill.SKILL_SQL].level).toBe(75); // 3 verified Arena tasks > the 38 assessment score
    expect(b.plan.readiness).toBeGreaterThan(a.plan.readiness);
    expect(b.plan.gaps.find((g) => g.skillId === skill.SKILL_SQL)!.gap).toBeLessThan(a.plan.gaps.find((g) => g.skillId === skill.SKILL_SQL)!.gap);
    await publishCurriculum("ZZ-R1", [{ title: "Database Management Systems", year: 3, semester: 1, skills: [{ key: "SKILL_SQL", importance: "CORE" }] }]); // v2 replaces v1
    const c = await ready();
    expect(c.meta.curriculumVersionId).not.toBe(a.meta.curriculumVersionId);
    expect(c.hash).not.toBe(b.hash);
    await saveCareerIntent(service, userId, { primaryCareerId: careerIds["software-engineer"], secondaryCareerId: null });
    const d = await ready();
    expect([d.input.career.name, d.hash === c.hash]).toEqual(["Software Engineer", false]);
    await saveCareerIntent(service, userId, { primaryCareerId: careerIds["data-analyst"] });
  });

  it("learning resources come only from the catalog, and are suggested for skills the curriculum does not fully cover", async () => {
    const { data: item } = await service.from("learning_catalog").insert({ title: "ZZ Dashboards 101", provider: `ZZ-${stamp}`, level_from: 0, level_to: 70, estimated_hours: 6 }).select("id").single();
    const { data: bi } = await service.from("learning_catalog").insert({ title: "ZZ Visualisation Basics", provider: `ZZ-${stamp}`, level_from: 0, level_to: 70 }).select("id").single();
    const { data: sql } = await service.from("learning_catalog").insert({ title: "ZZ SQL Bootcamp", provider: `ZZ-${stamp}`, level_from: 0, level_to: 90 }).select("id").single();
    await service.from("learning_item_skills").insert([{ item_id: item!.id, skill_id: skill.SKILL_PYTHON }, { item_id: bi!.id, skill_id: skill.SKILL_BI_DASHBOARDING }, { item_id: sql!.id, skill_id: skill.SKILL_SQL }]);
    const { plan } = await ready();
    const titles = plan.learning.map((l) => l.item.title);
    // Python and BI are not covered by the (current) curriculum, so their configured resources are suggested; SQL is STRONGLY covered by a core course, so none is
    expect(titles).toEqual(expect.arrayContaining(["ZZ Dashboards 101", "ZZ Visualisation Basics"]));
    expect(titles).not.toContain("ZZ SQL Bootcamp");
    expect(plan.learning.every((l) => l.skillId !== skill.SKILL_SQL)).toBe(true);
    expect(plan.learningNotConfigured.some((n) => n.skillName === "Python")).toBe(false);
    expect(plan.learningNotConfigured.some((n) => n.skillName === "Spreadsheets" || n.skillName === "Excel / Spreadsheets")).toBe(true); // uncovered and nothing configured: said plainly
  });

  it("only grounded AI sentences are kept; a failing model changes nothing else", async () => {
    const stub: ExplainFn = async (_career, subjects) => new Map(subjects.map((s, i) => [s.id, i === 0 ? `This subject builds ${s.skillNames[0]}.` : "This subject also teaches Quantum Gravity with 99 labs."]));
    const r = await ready({ explain: stub });
    expect(r.explanations.size).toBe(1);
    expect(r.explanationNotes.rejected).toBeGreaterThanOrEqual(0);
    const [id, sentence] = [...r.explanations][0];
    expect(r.plan.subjects.find((s) => s.courseId === id)!.facts.skillNames.some((n) => sentence.includes(n))).toBe(true);
    const failed = await ready({ explain: async () => { throw new Error("model down"); } });
    expect(failed.explanations.size).toBe(0);
    expect(failed.explanationNotes.failed).toBe(true);
    expect(failed.plan).toEqual((await ready()).plan); // the deterministic plan is untouched
    expect(failed.hash).toBe((await ready()).hash); // and the hash does not depend on prose
  });

  it("a student with no capability data still gets a roadmap, with a baseline assessment first", async () => {
    await service.from("capabilities").delete().eq("user_id", userId);
    await service.from("arena_skill_ratings").delete().eq("user_id", userId);
    const { plan, input } = await ready();
    expect(input.hasAnyCapabilityData).toBe(false);
    expect(plan.baselineRecommended).toBe(true);
    expect(plan.nextBestAction).toMatchObject({ kind: "ASSESS" });
    expect(plan.readiness).toBe(0);
  });
});

const r_gaps = (plan: PreparedRoadmap["plan"]) => plan.gaps;

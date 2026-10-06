import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createThrowawayUserWithLogin, deleteThrowawayUser, liveServiceClient, signedInClient } from "@/lib/arena-workstations/live-test-helpers";
import { saveGoalState } from "@/lib/career/direction-writes";
import { loadRoadmapForStudent } from "./load";

// Real DB, real reads through the student's OWN session. Disposable institution/student/curriculum, all deleted in afterAll.
const service = liveServiceClient();
const stamp = Date.now();
const thisYear = new Date().getFullYear();
let student: { userId: string; email: string; password: string };
let asStudent: SupabaseClient<Database>;
let instA: string, instB: string;

const run = () => loadRoadmapForStudent(asStudent, service, student.userId);
async function ready() {
  const r = await run();
  if (!r.applicable || r.roadmap.status !== "ready") throw new Error("expected a ready roadmap: " + JSON.stringify(r));
  return r.roadmap;
}
let skillOfArea = new Map<string, string>();
type FixtureCourse = { name: string; year: number; areas: string[]; ai?: boolean; removed?: boolean };
/** A curriculum in the NEW model: an import with courses and mappings (official unless `ai`), optionally published. Returns the import id. */
async function curriculum(inst: string, courses: FixtureCourse[], opts: { publish?: boolean; regulation?: string | null } = { publish: true }) {
  const { data: imp } = await service.from("curriculum_imports").insert({ institution_id: inst, branch: "ZZ Branch", status: "CONFIRMED", regulation: opts.regulation ?? null }).select("id").single();
  for (const c of courses) {
    const { data: row } = await service.from("courses").insert({ import_id: imp!.id, year: c.year, semester: 1, title: c.name, deleted_at: c.removed ? new Date().toISOString() : null }).select("id").single();
    if (c.areas.length) {
      const rows = c.areas.map((a) => (c.ai
        ? { course_id: row!.id, skill_id: skillOfArea.get(a)!, mapping_source: "AI_SUGGESTED", status: "SUGGESTED", confidence: 0.9 }
        : { course_id: row!.id, skill_id: skillOfArea.get(a)!, mapping_source: "MANUAL", status: "CONFIRMED", approved_at: new Date().toISOString() }));
      const { error } = await service.from("course_skill_mappings").insert(rows);
      if (error) throw new Error(error.message);
    }
  }
  if (opts.publish) {
    const { error } = await service.rpc("publish_curriculum_import", { p_import_id: imp!.id, p_user_id: null as unknown as string });
    if (error) throw new Error(error.message);
  }
  return imp!.id;
}
describe("roadmap for a real job-track student (disposable fixtures)", () => {
  beforeAll(async () => {
    student = await createThrowawayUserWithLogin(service, "rm-student");
    asStudent = await signedInClient(student.email, student.password);
    for (const [i, l] of ["a", "b"].entries()) {
      const { data } = await service.from("institutions").insert({ name: `ZZ ROADMAP LIVE ${l} ${stamp}`, slug: `zz-rml-${l}-${stamp}` }).select("id").single();
      if (i === 0) instA = data!.id;
      else instB = data!.id;
    }
    // Student is in year 3 (started two academic years ago), years NOT yet confirmed.
    await service.from("institution_memberships").insert({ user_id: student.userId, institution_id: instA, role: "student", status: "active", branch: "zz BRANCH", start_year: thisYear - 3, end_year: thisYear + 1 });
    const { data: areas } = await service.from("arena_skill_areas").select("area_key, skill_id").eq("role_key", "data-analyst");
    skillOfArea = new Map((areas ?? []).map((a) => [a.area_key, a.skill_id!]));
  });

  afterAll(async () => {
    await service.from("institution_memberships").delete().in("institution_id", [instA, instB]);
    await service.from("institutions").delete().in("id", [instA, instB]);
    await deleteThrowawayUser(service, student.userId);
  });

  it("unconfirmed years and no curriculum → honest needs_info (both reasons), not an empty roadmap", async () => {
    const r = await run();
    expect(r.applicable && r.roadmap.status === "needs_info" && r.roadmap.reasons.sort()).toEqual(["no_curriculum", "year_unknown"]);
  });

  it("after year confirmation but with no curriculum → only no_curriculum", async () => {
    await service.from("institution_memberships").update({ year_confirmed_at: new Date().toISOString(), year_override: 3 }).eq("user_id", student.userId);
    const r = await run();
    expect(r.applicable && r.roadmap.status === "needs_info" && r.roadmap.reasons).toEqual(["no_curriculum"]);
  });

  it("real curriculum + real verified state → the three buckets, matched case-insensitively on branch, other colleges never leak", async () => {
    await curriculum(instA, [
      { name: "Database Management Systems", year: 3, areas: ["sql"] },
      { name: "Probability and Statistics", year: 2, areas: ["statistics"] },
      { name: "Compilers", year: 3, areas: [] },
    ]);
    await curriculum(instB, [{ name: "Other college's subject", year: 3, areas: ["spreadsheet"] }]); // must not affect this student
    await service.from("arena_skill_ratings").insert([
      { user_id: student.userId, role_key: "data-analyst", area_key: "sql", rating: 450, verified_count: 3 },
      { user_id: student.userId, role_key: "data-analyst", area_key: "statistics", rating: 410, verified_count: 1 },
    ]);
    const rm = await ready();
    expect(rm.academicYear).toBe(3);
    expect(rm.affirm.map((i) => i.areaKey)).toEqual(["sql"]);
    expect(rm.engage.map((i) => i.areaKey)).toEqual(["statistics"]);
    expect(rm.engage[0].covering[0]).toMatchObject({ name: "Probability and Statistics", timing: "past" });
    expect(rm.engage[0].arenaTasksRemaining).toBe(2);
    expect(rm.external.map((i) => i.areaKey).sort()).toEqual(["dashboard", "data_cleaning", "spreadsheet"]);
    expect(rm.external.find((i) => i.areaKey === "spreadsheet")!.covering).toEqual([]); // instB's subject did not leak
    // Curated resources come only from the stored list.
    const titles = rm.external.flatMap((i) => i.resources.map((r) => r.title)).sort();
    expect(titles).toEqual(["Google Data Analytics Professional Certificate", "Microsoft Certified: Power BI Data Analyst Associate (PL-300)"]);
    // Python (executor disabled) is never a gap.
    expect([...rm.affirm, ...rm.engage, ...rm.external].map((i) => i.areaKey)).not.toContain("python");
  });

  it("AI suggestions, removed courses and unpublished drafts never reach the roadmap", async () => {
    // v2 replaces v1 on publish: its only mapping is an AI suggestion, and its only confirmed one sits on a removed course
    await curriculum(instA, [
      { name: "BI Lab", year: 3, areas: ["dashboard"], ai: true },
      { name: "Excel Basics", year: 3, areas: ["spreadsheet"], removed: true },
    ]);
    // a draft (never published) with an official mapping is invisible too
    await curriculum(instA, [{ name: "Draft Course", year: 3, areas: ["data_cleaning"] }], { publish: false });
    const r = await run();
    expect(r.applicable && r.roadmap.status === "needs_info" && r.roadmap.reasons).toEqual(["no_confirmed_mapping"]);
  });

  it("a newer published version replaces the older one", async () => {
    await curriculum(instA, [{ name: "Applied Statistics", year: 3, areas: ["statistics"] }]);
    const rm = await ready();
    const covering = [...rm.affirm, ...rm.engage, ...rm.external].flatMap((i) => i.covering.map((c) => c.name));
    expect(covering).toEqual(["Applied Statistics"]); // v1's Database Management Systems / Probability are archived; v2's suggestions never counted
    expect(rm.engage.find((i) => i.areaKey === "statistics")!.covering[0]).toMatchObject({ timing: "this_year" });
  });

  it("a student with a regulation sees only that regulation's curriculum — never a different one", async () => {
    // a second regulation coexists with the first (different regulation, so nothing is archived)
    await curriculum(instA, [{ name: "Regulation Two Course", year: 3, areas: ["sql"] }], { publish: true, regulation: "ZZ-R2" });
    const coveringOf = (rm: Awaited<ReturnType<typeof ready>>) => [...rm.affirm, ...rm.engage, ...rm.external].flatMap((i) => i.covering.map((c) => c.name));
    await service.from("institution_memberships").update({ regulation: "zz-r2" }).eq("user_id", student.userId); // case-insensitive
    expect(coveringOf(await ready())).toEqual(["Regulation Two Course"]);
    await service.from("institution_memberships").update({ regulation: "ZZ-R9" }).eq("user_id", student.userId);
    const r = await run();
    expect(r.applicable && r.roadmap.status === "needs_info" && r.roadmap.reasons).toEqual(["no_curriculum_for_regulation"]);
    await service.from("institution_memberships").update({ regulation: null }).eq("user_id", student.userId); // unknown -> the newest published
    expect(coveringOf(await ready())).toEqual(["Regulation Two Course"]);
  });

  it("track gating is live: job / not_sure / unset see it; higher studies and entrepreneur do not", async () => {
    const applicable = async () => (await run()).applicable;
    expect(await applicable()).toBe(true); // unset ⇒ job
    for (const [state, expected] of [["job", true], ["not_sure", true], ["higher_studies", false], ["entrepreneur", false], ["job", true]] as const) {
      await saveGoalState(service, student.userId, state);
      expect(await applicable(), state).toBe(expected);
    }
  });
});

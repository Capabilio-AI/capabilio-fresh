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
async function subject(inst: string, name: string, year: number, areas: string[]) {
  const { data } = await service.from("curriculum_subjects").insert({ institution_id: inst, branch: "ZZ Branch", year, name }).select("id").single();
  if (areas.length) await service.from("curriculum_subject_skill_map").insert(areas.map((a) => ({ subject_id: data!.id, role_key: "data-analyst", area_key: a, source: "admin" as const })));
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
  });

  afterAll(async () => {
    await service.from("curriculum_subjects").delete().in("institution_id", [instA, instB]);
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
    await subject(instA, "Database Management Systems", 3, ["sql"]);
    await subject(instA, "Probability and Statistics", 2, ["statistics"]);
    await subject(instA, "Compilers", 3, []);
    await subject(instB, "Other college's subject", 3, ["spreadsheet"]); // must not affect this student
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

  it("track gating is live: job / not_sure / unset see it; higher studies and entrepreneur do not", async () => {
    const applicable = async () => (await run()).applicable;
    expect(await applicable()).toBe(true); // unset ⇒ job
    for (const [state, expected] of [["job", true], ["not_sure", true], ["higher_studies", false], ["entrepreneur", false], ["job", true]] as const) {
      await saveGoalState(service, student.userId, state);
      expect(await applicable(), state).toBe(expected);
    }
  });
});

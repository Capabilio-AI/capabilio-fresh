import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createThrowawayUserWithLogin,
  deleteThrowawayUser,
  liveServiceClient,
  signedInClient,
} from "@/lib/arena-workstations/live-test-helpers";

// Live project, disposable rows only (npm run test:live). Exercises the SECURITY DEFINER class_* functions
// the API routes call, and the raw-client attacks against every new table. Everything is deleted afterwards.
const service = liveServiceClient();
const stamp = Date.now();
const rpc = (name: string, args: Record<string, unknown>) => (service as SupabaseClient).rpc(name, args);

interface Person {
  userId: string;
  email: string;
  password: string;
  membershipId: string;
}
let instA = "";
let instB = "";
const people: Record<string, Person> = {};
const userIds: string[] = [];

async function person(key: string, institutionId: string, role: string, branch: string | null): Promise<Person> {
  const u = await createThrowawayUserWithLogin(service, `cls-${key}`);
  userIds.push(u.userId);
  const { data, error } = await service
    .from("institution_memberships")
    .insert({ user_id: u.userId, institution_id: institutionId, role: role as never, branch, start_year: 2024, end_year: 2028 })
    .select("id")
    .single();
  if (error) throw error;
  await service.from("institution_memberships").update({ status: "active" }).eq("id", data.id); // trigger pends staff roles on insert
  const p = { ...u, membershipId: data.id };
  people[key] = p;
  return p;
}

async function project(over: Record<string, unknown> = {}): Promise<string> {
  const { data, error } = await (service as SupabaseClient)
    .from("class_projects")
    .insert({
      institution_id: instA,
      created_by_membership_id: people.staff.membershipId,
      title: `ZZ ${stamp} project`,
      brief: "Build something",
      submission_type: "in_app",
      deadline_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
      ...over,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

beforeAll(async () => {
  for (const [n, slug] of [["A", `zz-cls-a-${stamp}`], ["B", `zz-cls-b-${stamp}`]] as const) {
    const { data } = await service.from("institutions").insert({ name: `ZZ Classroom ${n} ${stamp}`, slug }).select("id").single();
    if (n === "A") instA = data!.id;
    else instB = data!.id;
  }
  await person("staff", instA, "faculty", "CSE");
  await person("staff2", instA, "faculty", "CSE");
  await person("admin", instA, "principal", null);
  await person("tpo", instA, "faculty", null); // role rewritten below to tpo
  await service.from("institution_memberships").update({ role: "tpo" as never }).eq("id", people.tpo.membershipId);
  await person("s1", instA, "student", "CSE");
  await person("s2", instA, "student", "ECE");
  await person("s3", instA, "student", "CSE");
  await person("s4", instA, "student", "MECH");
  await person("s5", instA, "student", "CSE");
  await person("outsider", instB, "student", "CSE");
  await person("staffB", instB, "faculty", "CSE");
}, 240_000);

afterAll(async () => {
  await service.from("opportunities").delete().eq("institution_id", instA);
  await service.from("institutions").delete().in("id", [instA, instB].filter(Boolean)); // cascades class_*/org_* rows
  for (const id of userIds) await deleteThrowawayUser(service, id);
}, 240_000);

describe("groups: formation rules are enforced in the database", () => {
  it("forms a group of four across departments, then refuses a fifth, an outsider, and double-joining", async () => {
    const pid = await project();
    const created = await rpc("class_create_group", { p_user_id: people.s1.userId, p_project_id: pid, p_name: "Alpha" });
    expect(created.error).toBeNull();
    const gid = created.data as string;
    for (const k of ["s2", "s3"]) expect((await rpc("class_join_group", { p_user_id: people[k].userId, p_group_id: gid })).error).toBeNull();
    // still forming with 3 -> submitting is refused
    expect((await rpc("class_submit_project", { p_user_id: people.s1.userId, p_group_id: gid, p_link: "https://x.co/a" })).error?.message).toContain("group_not_ready");
    expect((await rpc("class_join_group", { p_user_id: people.s4.userId, p_group_id: gid })).error).toBeNull();
    expect((await service.from("class_project_groups" as never).select("status").eq("id", gid).single() as { data: { status: string } }).data.status).toBe("active");

    expect((await rpc("class_join_group", { p_user_id: people.s5.userId, p_group_id: gid })).error?.message).toMatch(/group_not_forming|group_full/);
    // an outsider is refused on a group that is still forming (a full group is refused earlier, by status)
    const forming = (await rpc("class_create_group", { p_user_id: people.s5.userId, p_project_id: pid, p_name: "Open" })).data as string;
    expect((await rpc("class_join_group", { p_user_id: people.outsider.userId, p_group_id: forming })).error?.message).toContain("not_a_student_of_institution");
    expect((await rpc("class_create_group", { p_user_id: people.s1.userId, p_project_id: pid, p_name: "Again" })).error?.message).toContain("already_in_group");
    // non-student staff cannot form groups
    expect((await rpc("class_create_group", { p_user_id: people.staff.userId, p_project_id: pid, p_name: "Nope" })).error?.message).toContain("not_a_student_of_institution");
  }, 120_000);

  it("honours a department scope (case-insensitive) and closed projects", async () => {
    const scoped = await project({ department_scope: ["cse"] });
    expect((await rpc("class_create_group", { p_user_id: people.s1.userId, p_project_id: scoped, p_name: "In" })).error).toBeNull();
    expect((await rpc("class_create_group", { p_user_id: people.s2.userId, p_project_id: scoped, p_name: "Out" })).error?.message).toContain("department_not_in_scope");
    const closed = await project({ status: "closed" });
    expect((await rpc("class_create_group", { p_user_id: people.s3.userId, p_project_id: closed, p_name: "Late" })).error?.message).toContain("project_closed");
  }, 60_000);

  it("a leaving member reopens the group; a submitted group is locked", async () => {
    const pid = await project();
    const gid = (await rpc("class_create_group", { p_user_id: people.s1.userId, p_project_id: pid, p_name: "Leave" })).data as string;
    for (const k of ["s2", "s3", "s4"]) await rpc("class_join_group", { p_user_id: people[k].userId, p_group_id: gid });
    expect((await rpc("class_leave_group", { p_user_id: people.s4.userId, p_group_id: gid })).error).toBeNull();
    expect((await service.from("class_project_groups" as never).select("status").eq("id", gid).single() as { data: { status: string } }).data.status).toBe("forming");
    await rpc("class_join_group", { p_user_id: people.s5.userId, p_group_id: gid });
    expect((await rpc("class_submit_project", { p_user_id: people.s2.userId, p_group_id: gid, p_link: "https://x.co/b" })).error).toBeNull();
    expect((await rpc("class_leave_group", { p_user_id: people.s2.userId, p_group_id: gid })).error?.message).toContain("group_locked");
    expect((await rpc("class_submit_project", { p_user_id: people.s4.userId, p_group_id: gid, p_link: "https://x.co/c" })).error?.message).toContain("not_a_member");
  }, 120_000);
});

describe("grading: staff-verified, atomic, evidence per member", () => {
  let gid = "";
  let pid = "";
  beforeAll(async () => {
    pid = await project();
    gid = (await rpc("class_create_group", { p_user_id: people.s1.userId, p_project_id: pid, p_name: "Graded" })).data as string;
    for (const k of ["s2", "s3", "s4"]) await rpc("class_join_group", { p_user_id: people[k].userId, p_group_id: gid });
  }, 120_000);

  it("cannot be graded before submission", async () => {
    expect((await rpc("class_grade_group", { p_membership_id: people.staff.membershipId, p_group_id: gid, p_grade: "A", p_feedback: null, p_notes: {} })).error?.message).toContain("group_not_submitted");
  });

  it("refuses staff of another institution, non-owner staff, TPO and students", async () => {
    await rpc("class_submit_project", { p_user_id: people.s1.userId, p_group_id: gid, p_link: "https://x.co/work" });
    for (const k of ["staffB", "staff2", "tpo", "s1"]) {
      const r = await rpc("class_grade_group", { p_membership_id: people[k].membershipId, p_group_id: gid, p_grade: "A", p_feedback: null, p_notes: {} });
      expect(r.error?.message, k).toContain("forbidden");
    }
    const evidence = await service.from("evidence").select("id").in("user_id", ["s1", "s2", "s3", "s4"].map((k) => people[k].userId)).eq("evidence_type", "staff_graded_project");
    expect(evidence.data).toHaveLength(0);
  }, 60_000);

  it("the owning staff member grades: one staff-verified evidence row per member, idempotent on re-grade", async () => {
    const grade = (g: string, notes: Record<string, string> = {}) =>
      rpc("class_grade_group", { p_membership_id: people.staff.membershipId, p_group_id: gid, p_grade: g, p_feedback: "Good work", p_notes: notes });
    expect((await grade("B+", { [people.s1.userId]: "Led the build" })).error).toBeNull();

    const members = ["s1", "s2", "s3", "s4"].map((k) => people[k].userId);
    const rows = async () => (await service.from("evidence").select("user_id, skill, source_type, confidence, evidence_type, evaluated_by, source_url, metadata").in("user_id", members).eq("evidence_type", "staff_graded_project")).data ?? [];
    let ev = await rows();
    expect(ev).toHaveLength(4);
    for (const e of ev) {
      expect(e).toMatchObject({ skill: "Project Work", source_type: "project", confidence: "high", evaluated_by: people.staff.userId, source_url: "https://x.co/work" });
      expect(e.metadata).toMatchObject({ grade: "B+", groupSize: 4, provenance: "staff-verified", gradedByRole: "faculty" });
      expect(JSON.stringify(e.metadata)).not.toContain("Led the build"); // private contribution notes never leak into evidence
    }

    expect((await grade("A")).error).toBeNull();
    ev = await rows();
    expect(ev).toHaveLength(4); // upserted, not duplicated
    expect(ev.every((e) => (e.metadata as { grade: string }).grade === "A")).toBe(true);
    expect((await service.from("class_project_grades" as never).select("id").eq("group_id", gid) as { data: unknown[] }).data).toHaveLength(1);
  }, 60_000);

  it("contribution notes may only name members of the group", async () => {
    const r = await rpc("class_grade_group", { p_membership_id: people.staff.membershipId, p_group_id: gid, p_grade: "A", p_feedback: null, p_notes: { [people.outsider.userId]: "x" } });
    expect(r.error?.message).toContain("invalid_contribution_notes");
  });

  it("an admin of the institution may grade any project; weekly reports never create evidence", async () => {
    const pid2 = await project();
    const g2 = (await rpc("class_create_group", { p_user_id: people.s5.userId, p_project_id: pid2, p_name: "Admin graded" })).data as string;
    await (service as SupabaseClient).from("class_weekly_reports").insert({ group_id: g2, week_number: 1, submitted_by_user_id: people.s5.userId, content: "did things" });
    const before = await service.from("evidence").select("id", { count: "exact", head: true }).eq("user_id", people.s5.userId);
    expect(before.count).toBe(0);
  });
});

describe("physical submissions", () => {
  it("in-app submit is refused; only owning staff can mark received; then it can be graded", async () => {
    const pid = await project({ submission_type: "physical" });
    const gid = (await rpc("class_create_group", { p_user_id: people.s1.userId, p_project_id: pid, p_name: "Phys" })).data as string;
    for (const k of ["s2", "s3", "s4"]) await rpc("class_join_group", { p_user_id: people[k].userId, p_group_id: gid });
    expect((await rpc("class_submit_project", { p_user_id: people.s1.userId, p_group_id: gid, p_link: "https://x.co" })).error?.message).toContain("physical_submission_only");
    expect((await rpc("class_mark_physical_received", { p_membership_id: people.staff2.membershipId, p_group_id: gid })).error?.message).toContain("forbidden");
    expect((await rpc("class_mark_physical_received", { p_membership_id: people.staff.membershipId, p_group_id: gid })).error).toBeNull();
    expect((await rpc("class_grade_group", { p_membership_id: people.admin.membershipId, p_group_id: gid, p_grade: "A", p_feedback: null, p_notes: {} })).error).toBeNull();
    const ev = await service.from("evidence").select("source_url, metadata").eq("user_id", people.s1.userId).eq("evidence_type", "staff_graded_project");
    expect(ev.data?.some((e) => e.source_url === null && (e.metadata as { submission: string }).submission === "physical — verified by staff")).toBe(true);
  }, 90_000);
});

describe("raw-client attacks (public key + a real signed-in session, like devtools)", () => {
  const tables = ["class_materials", "class_projects", "class_project_groups", "class_project_group_members", "class_weekly_reports", "class_submissions", "class_project_grades", "org_profiles", "org_posts", "org_follows", "org_post_likes"];

  it("a signed-in student can neither read nor write any new table, nor call the state functions", async () => {
    const c = (await signedInClient(people.s1.email, people.s1.password)) as SupabaseClient;
    for (const t of tables) {
      const read = await c.from(t).select("*").limit(1);
      expect(read.error, `read ${t}`).not.toBeNull();
    }
    const gid = (await service.from("class_project_groups" as never).select("id").limit(1) as { data: { id: string }[] }).data[0].id;
    for (const [t, row] of [
      ["class_project_grades", { group_id: gid, graded_by_membership_id: people.s1.membershipId, grade: "A" }],
      ["class_project_group_members", { group_id: gid, project_id: gid, user_id: people.s1.userId }],
      ["org_posts", { institution_id: instA, author_membership_id: people.s1.membershipId, type: "announcement", title: "x", body: "y" }],
      ["class_projects", { institution_id: instA, created_by_membership_id: people.s1.membershipId, title: "x", brief: "y", submission_type: "in_app", deadline_at: "2099-01-01" }],
    ] as const) {
      expect((await c.from(t).insert(row)).error, `insert ${t}`).not.toBeNull();
    }
    for (const fn of ["class_grade_group", "class_create_group", "class_join_group", "class_submit_project", "create_org_signup"]) {
      expect((await c.rpc(fn, { p_user_id: people.s1.userId, p_group_id: gid, p_membership_id: people.staff.membershipId })).error, fn).not.toBeNull();
    }
  }, 60_000);

  it("a student cannot forge a grade or evidence for themself", async () => {
    const c = (await signedInClient(people.s5.email, people.s5.password)) as SupabaseClient;
    const forged = await c.from("evidence").insert({ user_id: people.s5.userId, skill: "Project Work", source_type: "project", confidence: "high", evidence_type: "staff_graded_project", source_identifier: `forged:${stamp}` });
    expect(forged.error).not.toBeNull();
  });
});

describe("placement drives are private to the institution (opportunities RLS)", () => {
  it("only active members of the posting institution can read it; platform-wide listings stay public", async () => {
    const { data: drive } = await service.from("opportunities").insert({ institution_id: instA, created_by: people.tpo.userId, role: "ZZ Analyst", company: "ZZ Corp", opportunity_type: "job", skills: [] }).select("id").single();
    const { data: open } = await service.from("opportunities").insert({ role: "ZZ Public Role", company: "ZZ Public", opportunity_type: "job", skills: [] }).select("id").single();
    try {
      const inA = (await signedInClient(people.s1.email, people.s1.password)) as SupabaseClient;
      const inB = (await signedInClient(people.outsider.email, people.outsider.password)) as SupabaseClient;
      const seenA = ((await inA.from("opportunities").select("id")).data ?? []).map((r: { id: string }) => r.id);
      const seenB = ((await inB.from("opportunities").select("id")).data ?? []).map((r: { id: string }) => r.id);
      expect(seenA).toContain(drive!.id);
      expect(seenA).toContain(open!.id);
      expect(seenB).not.toContain(drive!.id);
      expect(seenB).toContain(open!.id);
      // a client cannot post a drive for its own college either
      const forged = await inA.from("opportunities").insert({ institution_id: instA, role: "x", company: "y", opportunity_type: "job", skills: [] });
      expect(forged.error).not.toBeNull();
    } finally {
      await service.from("opportunities").delete().eq("id", open!.id);
    }
  }, 90_000);
});

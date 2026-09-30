import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createThrowawayUserWithLogin, deleteThrowawayUser, liveServiceClient, signedInClient } from "@/lib/arena-workstations/live-test-helpers";
import { getOrgAdmin } from "./admin-gate";
import { addSubjects, deleteSubject, setMapping } from "./curriculum-writes";
import { listSubjectsForAdmin } from "./admin-data";

// Real DB, real RBAC. Throwaway institutions/users are deleted in afterAll.
const service = liveServiceClient();
type U = { userId: string; email: string; password: string };
let adminA: U, adminB: U, student: U;
let asAdminA: SupabaseClient<Database>, asAdminB: SupabaseClient<Database>, asStudent: SupabaseClient<Database>;
let instA: string, instB: string;
const stamp = Date.now();

async function makeInstitution(label: string) {
  const { data } = await service.from("institutions").insert({ name: `ZZ ROADMAP ${label} ${stamp}`, slug: `zz-rm-${label.toLowerCase()}-${stamp}` }).select("id").single();
  return data!.id;
}
async function member(userId: string, institutionId: string, role: "student" | "principal") {
  await service.from("institution_memberships").insert({ user_id: userId, institution_id: institutionId, role, branch: role === "student" ? "ZZ" : null });
  // set_membership_status forces privileged roles to 'pending' on insert; the operator activates them via the service role.
  if (role !== "student") await service.from("institution_memberships").update({ status: "active" }).eq("user_id", userId).eq("institution_id", institutionId);
}

describe("curriculum admin: gating, authority, writes", () => {
  beforeAll(async () => {
    [adminA, adminB, student] = await Promise.all(["a", "b", "s"].map((l) => createThrowawayUserWithLogin(service, `rm-${l}`)));
    [instA, instB] = await Promise.all([makeInstitution("A"), makeInstitution("B")]);
    await Promise.all([member(adminA.userId, instA, "principal"), member(adminB.userId, instB, "principal"), member(student.userId, instA, "student")]);
    [asAdminA, asAdminB, asStudent] = await Promise.all([adminA, adminB, student].map((u) => signedInClient(u.email, u.password)));
  });

  afterAll(async () => {
    await service.from("curriculum_subjects").delete().in("institution_id", [instA, instB]);
    await service.from("institution_memberships").delete().in("institution_id", [instA, instB]);
    await service.from("institutions").delete().in("id", [instA, instB]);
    await Promise.all([adminA, adminB, student].map((u) => deleteThrowawayUser(service, u.userId)));
  });

  it("a student is not an org admin; each admin resolves only to their own institution", async () => {
    expect(await getOrgAdmin(asStudent, student.userId)).toBeNull();
    expect((await getOrgAdmin(asAdminA, adminA.userId))?.institutionId).toBe(instA);
    expect((await getOrgAdmin(asAdminB, adminB.userId))?.institutionId).toBe(instB);
  });

  it("a pending (not yet activated) principal is not an admin", async () => {
    const pending = await createThrowawayUserWithLogin(service, "rm-p");
    await service.from("institution_memberships").insert({ user_id: pending.userId, institution_id: instA, role: "principal" });
    const c = await signedInClient(pending.email, pending.password);
    expect(await getOrgAdmin(c, pending.userId)).toBeNull();
    await service.from("institution_memberships").delete().eq("user_id", pending.userId);
    await deleteThrowawayUser(service, pending.userId);
  });

  it("no client — not even an admin — can read or write the curriculum tables directly", async () => {
    for (const t of ["curriculum_subjects", "curriculum_subject_skill_map", "role_target_profiles", "skill_area_resources"] as const) {
      expect((await asAdminA.from(t).select("*").limit(1)).error, `${t} read`).not.toBeNull();
      expect((await asAdminA.from(t).insert({} as never).select()).error, `${t} insert`).not.toBeNull();
      expect((await asStudent.from(t).update({} as never).eq("role_key" as never, "x").select()).error, `${t} update`).not.toBeNull();
      expect((await asStudent.from(t).delete().eq("role_key" as never, "x").select()).error, `${t} delete`).not.toBeNull();
    }
  });

  it("adds subjects to the admin's institution, skips duplicates, stores mappings only for real skill areas", async () => {
    const body = { branch: "ZZ Branch", year: 3, subjects: [{ name: "Database Management Systems", code: "CS301" }, { name: "Probability and Statistics" }] };
    expect(await addSubjects(service, { userId: adminA.userId, institutionId: instA }, body)).toMatchObject({ ok: true, count: 2 });
    expect(await addSubjects(service, { userId: adminA.userId, institutionId: instA }, { ...body, subjects: [{ name: "  database management systems " }] })).toMatchObject({ ok: true, count: 0 });

    const subjects = await listSubjectsForAdmin(service, instA, "data-analyst");
    expect(subjects).toHaveLength(2);
    const dbms = subjects.find((s) => s.name.startsWith("Database"))!;

    expect(await setMapping(service, { userId: adminA.userId, institutionId: instA }, dbms.id, "data-analyst", ["sql", "not-an-area"], false)).toMatchObject({ ok: false, status: 400 });
    expect(await setMapping(service, { userId: adminA.userId, institutionId: instA }, dbms.id, "data-analyst", ["sql"], true)).toMatchObject({ ok: true });
    const { data: map } = await service.from("curriculum_subject_skill_map").select("area_key, source, confirmed_by").eq("subject_id", dbms.id);
    expect(map).toEqual([{ area_key: "sql", source: "ai_suggestion_confirmed", confirmed_by: adminA.userId }]);

    // Replacing the mapping replaces, not appends.
    await setMapping(service, { userId: adminA.userId, institutionId: instA }, dbms.id, "data-analyst", ["sql", "data_cleaning"], false);
    expect((await listSubjectsForAdmin(service, instA, "data-analyst")).find((s) => s.id === dbms.id)!.mappedAreaKeys.sort()).toEqual(["data_cleaning", "sql"]);
  });

  it("an admin cannot map or delete another institution's subject", async () => {
    const [foreign] = await listSubjectsForAdmin(service, instA, "data-analyst");
    expect(await setMapping(service, { userId: adminB.userId, institutionId: instB }, foreign.id, "data-analyst", ["sql"], false)).toMatchObject({ ok: false, status: 404 });
    expect(await deleteSubject(service, instB, foreign.id)).toMatchObject({ ok: false, status: 404 });
    expect(await deleteSubject(service, instA, foreign.id)).toEqual({ ok: true });
  });
});

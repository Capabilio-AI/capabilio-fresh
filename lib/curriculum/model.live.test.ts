import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { liveServiceClient } from "@/lib/arena-workstations/live-test-helpers";

// Real DB. A throwaway institution carries every fixture; the last test deletes it and proves the cascade is clean.
const service = liveServiceClient();
const stamp = Date.now();
let inst: string;
let skillA: string, skillB: string;

async function newImport(regulation: string | null, status: "DRAFT" | "CONFIRMED" = "DRAFT") {
  const { data, error } = await service.from("curriculum_imports").insert({ institution_id: inst, branch: "ZZ Branch", regulation, status }).select("id").single();
  expect(error?.message ?? null).toBeNull();
  return data!.id;
}
async function addCourse(importId: string, title: string, year = 1) {
  const { data, error } = await service.from("courses").insert({ import_id: importId, year, semester: 1, title }).select("id").single();
  expect(error?.message ?? null).toBeNull();
  return data!.id;
}
async function advance(importId: string, ...path: string[]) {
  for (const status of path) {
    const { error } = await service.from("curriculum_imports").update({ status }).eq("id", importId);
    expect(error ? `${error.code}: ${error.message}` : null, `-> ${status}`).toBeNull();
  }
}
const publish = (importId: string) => service.rpc("publish_curriculum_import", { p_import_id: importId, p_user_id: null as unknown as string });

beforeAll(async () => {
  const { data } = await service.from("institutions").insert({ name: `ZZ CURRICULUM ${stamp}`, slug: `zz-cur-${stamp}` }).select("id").single();
  inst = data!.id;
  const { data: skills } = await service.from("skills").select("id").eq("status", "active").limit(2);
  [skillA, skillB] = skills!.map((s) => s.id);
});

afterAll(async () => {
  // normally already removed by the last test; this is the safety net
  await service.from("institutions").delete().eq("id", inst);
});

describe("curriculum model (live)", () => {
  it("an editable import accepts the whole course tree", async () => {
    const imp = await newImport("ZZ-R1");
    const course = await addCourse(imp, "Algorithms");
    const { data: co } = await service.from("course_outcomes").insert({ course_id: course, code: "CO1", text: "Analyse the time complexity of algorithms", bloom_level: "Analyze" }).select("id").single();
    const { data: unit } = await service.from("course_units").insert({ course_id: course, unit_no: 1, title: "Intro", hours: 8 }).select("id").single();
    expect((await service.from("unit_topics").insert({ unit_id: unit!.id, course_id: course, text: "Asymptotic notation" })).error).toBeNull();
    expect((await service.from("lab_experiments").insert({ course_id: course, text: "Implement merge sort" })).error).toBeNull();
    expect((await service.from("program_outcomes").insert({ import_id: imp, kind: "PO", code: "PO1", text: "Engineering knowledge" })).error).toBeNull();
    expect((await service.from("other_curriculum_items").insert({ import_id: imp, type: "MOOC", title: "12-week MOOC" })).error).toBeNull();
    expect((await service.from("course_skill_mappings").insert({ course_id: course, skill_id: skillA, mapping_source: "AI_SUGGESTED", status: "SUGGESTED", confidence: 0.8 })).error).toBeNull();
    expect((await service.from("course_outcome_skill_mappings").insert({ course_outcome_id: co!.id, course_id: course, skill_id: skillA, mapping_source: "AI_SUGGESTED" })).error).toBeNull();
    // a unit topic cannot point at another course's unit
    const other = await addCourse(imp, "Other");
    expect((await service.from("unit_topics").insert({ unit_id: unit!.id, course_id: other, text: "x" })).error).not.toBeNull();
  });

  it("the database refuses an AI suggestion that is CONFIRMED, and a CONFIRMED row with no approval time", async () => {
    const imp = await newImport("ZZ-R2");
    const course = await addCourse(imp, "DBMS");
    const aiConfirmed = await service.from("course_skill_mappings").insert({ course_id: course, skill_id: skillA, mapping_source: "AI_SUGGESTED", status: "CONFIRMED", approved_at: new Date().toISOString() });
    expect(aiConfirmed.error?.message).toMatch(/ai_never_official/);
    const noApproval = await service.from("course_skill_mappings").insert({ course_id: course, skill_id: skillA, mapping_source: "MANUAL", status: "CONFIRMED" });
    expect(noApproval.error?.message).toMatch(/confirmed_has_approval/);
    const outcomeBad = await service.from("course_outcome_skill_mappings").insert({ course_outcome_id: "00000000-0000-0000-0000-000000000000", course_id: course, skill_id: skillA, mapping_source: "MANUAL", status: "CONFIRMED" });
    expect(outcomeBad.error).not.toBeNull();
  });

  it("follows the status lifecycle and refuses jumps", async () => {
    const imp = await newImport("ZZ-R3");
    await addCourse(imp, "Networks");
    for (const to of ["PUBLISHED", "CONFIRMED", "ARCHIVED", "UNDER_REVIEW"]) {
      expect((await service.from("curriculum_imports").update({ status: to }).eq("id", imp)).error, `DRAFT -> ${to}`).not.toBeNull();
    }
    expect((await publish(imp)).error?.message).toMatch(/Only a confirmed import/);
    await advance(imp, "EXTRACTED", "UNDER_REVIEW", "CONFIRMED");
    expect((await publish(imp)).error).toBeNull();
  });

  it("an import with no courses cannot be published", async () => {
    const imp = await newImport("ZZ-R4");
    await advance(imp, "EXTRACTED", "UNDER_REVIEW", "CONFIRMED");
    expect((await publish(imp)).error?.message).toMatch(/no courses/);
  });

  it("publishing creates an immutable version and freezes the whole import", async () => {
    const imp = await newImport("ZZ-R5");
    const course = await addCourse(imp, "OS");
    const { data: co } = await service.from("course_outcomes").insert({ course_id: course, code: "CO1", text: "Explain scheduling" }).select("id").single();
    await service.from("course_skill_mappings").insert({ course_id: course, skill_id: skillA, mapping_source: "MANUAL", status: "CONFIRMED", approved_at: new Date().toISOString() });
    await advance(imp, "EXTRACTED", "UNDER_REVIEW", "CONFIRMED");
    const { data: versionId, error } = await publish(imp);
    expect(error).toBeNull();

    const { data: v } = await service.from("curriculum_versions").select("version_no, import_id, regulation").eq("id", versionId!).single();
    expect(v).toEqual({ version_no: 1, import_id: imp, regulation: "ZZ-R5" });
    const { data: row } = await service.from("curriculum_imports").select("status, published_at").eq("id", imp).single();
    expect(row!.status).toBe("PUBLISHED");
    expect(row!.published_at).not.toBeNull();

    // frozen: every table under it refuses writes
    expect((await service.from("courses").update({ title: "Changed" }).eq("id", course)).error?.message).toMatch(/published/);
    expect((await service.from("courses").insert({ import_id: imp, year: 1, title: "New" })).error?.message).toMatch(/published/);
    expect((await service.from("courses").delete().eq("id", course)).error?.message).toMatch(/published/);
    expect((await service.from("course_outcomes").update({ text: "x" }).eq("id", co!.id)).error?.message).toMatch(/published/);
    expect((await service.from("course_skill_mappings").update({ status: "REJECTED" }).eq("course_id", course)).error?.message).toMatch(/published/);
    expect((await service.from("course_skill_mappings").insert({ course_id: course, skill_id: skillB, mapping_source: "MANUAL", status: "CONFIRMED", approved_at: new Date().toISOString() })).error?.message).toMatch(/published/);
    expect((await service.from("program_outcomes").insert({ import_id: imp, kind: "PO", code: "PO9", text: "x" })).error?.message).toMatch(/published/);
    expect((await service.from("curriculum_imports").update({ regulation: "other" }).eq("id", imp)).error?.message).toMatch(/cannot be modified/);
    expect((await service.from("curriculum_imports").delete().eq("id", imp)).error?.message).toMatch(/never deleted/);
    // the version row is immutable
    expect((await service.from("curriculum_versions").update({ version_no: 9 }).eq("id", versionId!)).error?.message).toMatch(/immutable/);
    expect((await service.from("curriculum_versions").delete().eq("id", versionId!)).error?.message).toMatch(/immutable/);
    // and cannot be published twice
    expect((await publish(imp)).error?.message).toMatch(/Only a confirmed import/);
  });

  it("a new version of the same regulation supersedes and archives the old one; another regulation coexists", async () => {
    const reg = "ZZ-R6";
    const v1 = await newImport(reg);
    await addCourse(v1, "Compilers");
    await advance(v1, "EXTRACTED", "UNDER_REVIEW", "CONFIRMED");
    await publish(v1);

    const v2 = await newImport(reg);
    await addCourse(v2, "Compilers");
    await advance(v2, "EXTRACTED", "UNDER_REVIEW", "CONFIRMED");
    const { data: v2Version } = await publish(v2);

    const { data: first } = await service.from("curriculum_imports").select("status").eq("id", v1).single();
    const { data: second } = await service.from("curriculum_imports").select("status, supersedes_import_id").eq("id", v2).single();
    expect(first!.status).toBe("ARCHIVED");
    expect(second).toEqual({ status: "PUBLISHED", supersedes_import_id: v1 });
    expect((await service.from("curriculum_versions").select("version_no").eq("id", v2Version!).single()).data!.version_no).toBe(2);
    // archived is frozen and terminal
    expect((await service.from("courses").insert({ import_id: v1, year: 1, title: "Late" })).error?.message).toMatch(/published/);
    expect((await service.from("curriculum_imports").update({ status: "PUBLISHED" }).eq("id", v1)).error).not.toBeNull();

    const other = await newImport("ZZ-R6-other");
    await addCourse(other, "Compilers");
    await advance(other, "EXTRACTED", "UNDER_REVIEW", "CONFIRMED");
    await publish(other);
    expect((await service.from("curriculum_imports").select("status").eq("id", v2).single()).data!.status).toBe("PUBLISHED");
  });

  it("no browser client can read the model or call publish", async () => {
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
    for (const t of ["curriculum_imports", "curriculum_versions", "courses", "course_outcomes", "course_skill_mappings", "course_outcome_skill_mappings", "program_outcomes"] as const) {
      const r = await anon.from(t).select("*").limit(1);
      expect(r.error, t).not.toBeNull();
    }
    expect((await anon.rpc("publish_curriculum_import", { p_import_id: "00000000-0000-0000-0000-000000000000", p_user_id: "00000000-0000-0000-0000-000000000000" })).error).not.toBeNull();
  });

  it("deleting the institution removes its curriculum, published or not", async () => {
    const { error } = await service.from("institutions").delete().eq("id", inst);
    expect(error).toBeNull();
    const { count } = await service.from("curriculum_imports").select("id", { count: "exact", head: true }).eq("institution_id", inst);
    expect(count).toBe(0);
    const { count: vc } = await service.from("curriculum_versions").select("id", { count: "exact", head: true }).eq("institution_id", inst);
    expect(vc).toBe(0);
  });
});

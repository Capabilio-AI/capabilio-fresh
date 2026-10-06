import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { liveServiceClient } from "@/lib/arena-workstations/live-test-helpers";
import { normalizeSkillText } from "@/lib/skills/normalize";
import { parseCourseSection } from "./section";
import { saveExtractionAsImport } from "./persist";
import { suggestSkillsForImport } from "./suggest-skills";

// Real DB, stubbed AI. Throwaway institutions carry every fixture; deleting them cascades the imports.
const service = liveServiceClient();
const stamp = Date.now();
const NOVEL = `ZZ Novel Skill ${stamp}`;
let instA = "", instB = "", userA = "";

const DBMS_TEXT = ["Course Objectives:", "• Introduce relational databases and SQL", "Course Outcomes", "CO1: Develop and execute SQL queries for data definition and manipulation (K3)", "CO2: Explain transaction management and concurrency control (K2)", "UNIT I:", "Introduction: Database system, Data models", "L T P C", "3 0 0 3"];

async function newImport(label: string, instId = instA, courses = 2) {
  const list = [{ name: `Database Management Systems ${label}`, lines: DBMS_TEXT }, { name: `Library Hour ${label}`, lines: [] as string[] }].slice(0, courses);
  return saveExtractionAsImport(service, {
    institutionId: instId, userId: userA, branch: "ZZ Branch", fileName: "t.pdf", regulation: "ZZ", program: "B.Tech", model: "stub", version: "test", summary: {},
    outcomes: [],
    courses: list.map((c) => ({ row: { year: 2, semester: 2, name: c.name, code: null, category: null, kind: "course" as const }, parsed: parseCourseSection(c.lines), structuredBy: "parser" as const, mappings: [] })),
  });
}
const stub = (calls: { n: number }) => async (courses: { id: string; title: string }[]) => {
  calls.n++;
  return courses.filter((c) => /database/i.test(c.title)).map((c) => ({
    id: c.id,
    skills: [
      { name: "SQL", evidence: "CO1: Develop and execute SQL queries for data definition and manipulation", outcomes: ["CO1", "CO9"], confidence: "high" as const },
      { name: "Database Management Systems", evidence: "Introduce relational databases and SQL", outcomes: [], confidence: "medium" as const },
      { name: NOVEL, evidence: "Explain transaction management and concurrency control", outcomes: ["CO2"], confidence: "low" as const },
      { name: "Rocket Science", evidence: "Students will build rockets in orbit", outcomes: [], confidence: "high" as const },
    ],
  }));
};
const course = async (importId: string, prefix: string) => (await service.from("courses").select("id, provenance").eq("import_id", importId).like("title", `${prefix}%`).single()).data!;

beforeAll(async () => {
  const mk = async (l: string) => (await service.from("institutions").insert({ name: `ZZ SKILLS ${l} ${stamp}`, slug: `zz-sk-${l.toLowerCase()}-${stamp}` }).select("id").single()).data!.id;
  [instA, instB] = await Promise.all([mk("A"), mk("B")]);
  userA = (await service.auth.admin.createUser({ email: `zz-sk-${stamp}@example.com`, password: "Zz-sk-pass-123!", email_confirm: true })).data.user!.id;
}, 60_000);

afterAll(async () => {
  await service.from("institutions").delete().in("id", [instA, instB]);
  await service.from("skill_suggestions").delete().eq("normalized_text", normalizeSkillText(NOVEL));
  await service.auth.admin.deleteUser(userA);
});

describe("suggest skills for an import (live DB, stubbed AI)", () => {
  it("writes SUGGESTED/AI_SUGGESTED mappings at course and outcome level, queues what it cannot resolve, drops unjustified ones", async () => {
    const imp = await newImport("one");
    const calls = { n: 0 };
    const r = await suggestSkillsForImport(service, { institutionId: instA }, imp, { suggest: stub(calls) });
    expect(r).toMatchObject({ ok: true, processed: 2, remaining: 0, suggested: 2, unresolved: 1, failedBatches: 0 });

    const dbms = await course(imp, "Database Management Systems");
    const { data: maps } = await service.from("course_skill_mappings").select("status, mapping_source, confidence, evidence_source, skill_id, approved_at").eq("course_id", dbms.id);
    expect(maps).toHaveLength(2); // SQL + DBMS; "Rocket Science" dropped (evidence not in the course), the novel skill queued
    expect(maps!.every((m) => m.status === "SUGGESTED" && m.mapping_source === "AI_SUGGESTED" && m.approved_at === null)).toBe(true);
    expect(maps!.map((m) => m.confidence).sort()).toEqual([0.7, 0.9]);

    const { data: om } = await service.from("course_outcome_skill_mappings").select("course_outcome_id").eq("course_id", dbms.id);
    expect(om).toHaveLength(1); // CO1 -> SQL; CO9 does not exist
    const { data: co } = await service.from("course_outcomes").select("code").eq("id", om![0].course_outcome_id).single();
    expect(co!.code).toBe("CO1");

    const { data: queued } = await service.from("skill_suggestions").select("status, source").eq("normalized_text", normalizeSkillText(NOVEL)).single();
    expect(queued).toEqual({ status: "pending", source: "course_mapping" });
    expect((await service.from("skills").select("id", { count: "exact", head: true }).eq("name", NOVEL)).count).toBe(0); // never auto-created
    expect((await course(imp, "Library Hour")).provenance).toHaveProperty("_skillsSuggestedAt"); // nothing to read: marked, not retried forever
  });

  it("is idempotent: a second call does no work and creates no duplicates", async () => {
    const imp = await newImport("two");
    const calls = { n: 0 };
    const first = await suggestSkillsForImport(service, { institutionId: instA }, imp, { suggest: stub(calls) });
    expect(first, "first call").toMatchObject({ ok: true, processed: 2 });
    const again = await suggestSkillsForImport(service, { institutionId: instA }, imp, { suggest: stub(calls) });
    expect(again).toMatchObject({ ok: true, processed: 0, remaining: 0 });
    expect(calls.n).toBe(1);
    const dbms = await course(imp, "Database Management Systems");
    expect((await service.from("course_skill_mappings").select("id", { count: "exact", head: true }).eq("course_id", dbms.id)).count).toBe(2);
  });

  it("never touches a CONFIRMED mapping and never resurrects a REJECTED one", async () => {
    const imp = await newImport("three", instA, 1);
    const dbms = await course(imp, "Database Management Systems");
    const { data: sql } = await service.from("skills").select("id").eq("key", "SKILL_SQL").single();
    const { data: dbmsSkill } = await service.from("skills").select("id").eq("key", "SKILL_DBMS").single();
    await service.from("course_skill_mappings").insert([
      { course_id: dbms.id, skill_id: sql!.id, mapping_source: "MANUAL", status: "CONFIRMED", approved_at: new Date().toISOString(), confidence: null },
      { course_id: dbms.id, skill_id: dbmsSkill!.id, mapping_source: "AI_SUGGESTED", status: "REJECTED", confidence: 0.2 },
    ]);
    const r = await suggestSkillsForImport(service, { institutionId: instA }, imp, { suggest: stub({ n: 0 }) });
    expect(r).toMatchObject({ ok: true, suggested: 0 });
    const { data: maps } = await service.from("course_skill_mappings").select("skill_id, status, mapping_source, confidence").eq("course_id", dbms.id);
    expect(maps).toHaveLength(2);
    expect(maps!.find((m) => m.skill_id === sql!.id)).toMatchObject({ status: "CONFIRMED", mapping_source: "MANUAL", confidence: null });
    expect(maps!.find((m) => m.skill_id === dbmsSkill!.id)).toMatchObject({ status: "REJECTED", confidence: 0.2 });
  });

  it("handles a bounded number of courses per call and reports what remains", async () => {
    const imp = await newImport("four");
    const first = await suggestSkillsForImport(service, { institutionId: instA }, imp, { suggest: stub({ n: 0 }), limit: 1 });
    expect(first).toMatchObject({ ok: true, processed: 1, remaining: 1 });
    const second = await suggestSkillsForImport(service, { institutionId: instA }, imp, { suggest: stub({ n: 0 }), limit: 1 });
    expect(second).toMatchObject({ ok: true, processed: 1, remaining: 0 });
  });

  it("a failed AI batch leaves its courses unmarked so they are retried", async () => {
    const imp = await newImport("five", instA, 1);
    const failing = vi.fn().mockRejectedValue(new Error("model down"));
    const bad = await suggestSkillsForImport(service, { institutionId: instA }, imp, { suggest: failing });
    expect(bad).toMatchObject({ ok: true, processed: 0, remaining: 1, failedBatches: 1 });
    const good = await suggestSkillsForImport(service, { institutionId: instA }, imp, { suggest: stub({ n: 0 }) });
    expect(good).toMatchObject({ ok: true, processed: 1, remaining: 0, suggested: 2 });
  });

  it("refuses another institution's import, a published import, and a missing one", async () => {
    const imp = await newImport("six", instA, 1);
    expect(await suggestSkillsForImport(service, { institutionId: instB }, imp, { suggest: stub({ n: 0 }) })).toMatchObject({ ok: false, status: 404 });
    expect(await suggestSkillsForImport(service, { institutionId: instA }, "00000000-0000-0000-0000-000000000000", { suggest: stub({ n: 0 }) })).toMatchObject({ ok: false, status: 404 });
    for (const s of ["UNDER_REVIEW", "CONFIRMED"]) await service.from("curriculum_imports").update({ status: s }).eq("id", imp);
    await service.rpc("publish_curriculum_import", { p_import_id: imp, p_user_id: userA });
    expect(await suggestSkillsForImport(service, { institutionId: instA }, imp, { suggest: stub({ n: 0 }) })).toMatchObject({ ok: false, status: 409 });
  });
});

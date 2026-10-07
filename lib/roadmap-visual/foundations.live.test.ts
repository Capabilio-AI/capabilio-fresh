import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createThrowawayUser, createThrowawayUserWithLogin, deleteThrowawayUser, liveServiceClient, signedInClient } from "@/lib/arena-workstations/live-test-helpers";
import { untyped } from "@/lib/org/db";
import { loadStudentCapabilities } from "@/lib/capability/read-model";
import { logAiCall } from "@/lib/ai/log";
import { getInferredMinConfidence } from "./settings";

// Live: the Phase 1 data model enforces what the product promises (review gates, canonical skills only, owner-only reads), and the v2 score is honest.
const service = liveServiceClient();
const db = untyped(service);
const userIds: string[] = [];
let reviewer: string;
let student: { userId: string; email: string; password: string };
let careerId: string;
let activeSkillId: string;
let candidateSkillId: string;
let templateId: string;
const ok = async <T,>(p: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<NonNullable<T>> => {
  const r = await p;
  if (r.error || r.data === null || r.data === undefined) throw new Error(r.error?.message ?? "no data");
  return r.data as NonNullable<T>;
};
const insertNode = (over: Record<string, unknown>) => db.from("roadmap_nodes").insert({ template_id: templateId, stage: "FOUNDATION", ...over }).select("id").single();

beforeAll(async () => {
  reviewer = await createThrowawayUser(service, "p1-reviewer");
  student = await createThrowawayUserWithLogin(service, "p1-student");
  userIds.push(reviewer, student.userId);
  careerId = (await ok(service.from("careers").select("id").eq("key", "cloud-engineer").single())).id;
  activeSkillId = (await ok(service.from("skills").select("id").eq("name", "SQL").single())).id;
  await service.from("skills").delete().eq("key", "SKILL_ZZ_LIVE_CANDIDATE");
  candidateSkillId = (await ok(service.from("skills").insert({ name: "ZZ Live Candidate", key: "SKILL_ZZ_LIVE_CANDIDATE", domain: "Test", category: "test", status: "candidate" }).select("id").single())).id;
});
afterAll(async () => {
  await service.from("skills").delete().eq("key", "SKILL_ZZ_LIVE_CANDIDATE");
  await db.from("roadmap_templates").delete().eq("title", "zz live template");
  await db.from("diagnostic_items").delete().like("prompt", "zz live%");
  await db.from("ai_call_log").delete().eq("feature", "zz-live-feature");
  for (const u of userIds) await deleteThrowawayUser(service, u);
});

describe("templates and nodes", () => {
  it("a template cannot be reviewed-or-published without a reviewer, and only one is published per career", async () => {
    const base = { career_id: careerId, version: 9001, title: "zz live template", provenance: { designedBy: "test" } };
    const bad = await db.from("roadmap_templates").insert({ ...base, status: "PUBLISHED" });
    expect(bad.error?.message).toMatch(/review_required/);
    const draft = await ok(db.from("roadmap_templates").insert(base).select("id, status").single());
    expect(draft.status).toBe("DRAFT");
    templateId = draft.id;
    expect((await db.from("roadmap_templates").update({ status: "PUBLISHED" }).eq("id", templateId)).error?.message).toMatch(/review_required/);
    await ok(db.from("roadmap_templates").update({ status: "PUBLISHED", reviewed_by: reviewer, reviewed_at: new Date().toISOString() }).eq("id", templateId).select("id"));
    const second = await db.from("roadmap_templates").insert({ ...base, version: 9002, status: "PUBLISHED", reviewed_by: reviewer });
    expect(second.error?.message).toMatch(/one_published/);
  });

  it("a node can only use an ACTIVE canonical skill, and a topic must be scorable", async () => {
    const spine = await ok(insertNode({ node_key: "spine-a", type: "SPINE", title: "Spine", side: "CENTER" }));
    const group = await ok(insertNode({ node_key: "group-a", type: "GROUP", title: "Group", parent_node_id: spine.id, side: "LEFT" }));
    expect((await insertNode({ node_key: "t-cand", type: "TOPIC", title: "T", parent_node_id: group.id, skill_id: candidateSkillId, target_level: 60 })).error?.message).toMatch(/active skill/);
    expect((await insertNode({ node_key: "t-noskill", type: "TOPIC", title: "T", parent_node_id: group.id, target_level: 60 })).error?.message).toMatch(/topic_scored/);
    expect((await insertNode({ node_key: "t-notarget", type: "TOPIC", title: "T", parent_node_id: group.id, skill_id: activeSkillId })).error?.message).toMatch(/topic_scored/);
    expect((await insertNode({ node_key: "spine-left", type: "SPINE", title: "S", side: "LEFT" })).error?.message).toMatch(/spine_center/);
    const topic = await ok(insertNode({ node_key: "t-ok", type: "TOPIC", title: "SQL basics", parent_node_id: group.id, skill_id: activeSkillId, target_level: 70 }));
    expect(topic.id).toBeTruthy();
    const loop = await db.from("roadmap_edges").insert({ template_id: templateId, from_node_id: topic.id, to_node_id: topic.id, type: "PREREQUISITE" });
    expect(loop.error).not.toBeNull();
  });

  it("a student reads a PUBLISHED template, but not a draft, and cannot write", async () => {
    const asStudent = await signedInClient(student.email, student.password);
    const published = await asStudent.from("roadmap_templates" as never).select("id, title");
    expect((published.data as { id: string }[]).map((t) => t.id)).toContain(templateId);
    expect(((await untyped(asStudent).from("roadmap_nodes").select("node_key").eq("template_id", templateId)).data ?? []).length).toBeGreaterThan(0);
    expect((await untyped(asStudent).from("roadmap_templates").select("spec_hash")).error).not.toBeNull(); // ungranted column
    expect((await untyped(asStudent).from("roadmap_nodes").insert({ template_id: templateId, node_key: "hack", type: "GROUP", title: "x", stage: "CORE", side: "LEFT" })).error).not.toBeNull();
    await db.from("roadmap_templates").update({ status: "RETIRED" }).eq("id", templateId);
    expect(((await asStudent.from("roadmap_templates" as never).select("id").eq("id", templateId)).data as unknown[]).length).toBe(0); // retired: gone for students
  });
});

describe("node state, diagnostics, settings and AI log", () => {
  it("skipping needs a reason; a student sees only their own state", async () => {
    const node = (await ok(db.from("roadmap_nodes").select("id").eq("template_id", templateId).eq("node_key", "t-ok").single())).id;
    expect((await db.from("roadmap_node_state").insert({ student_id: student.userId, node_id: node, status: "SKIPPED" })).error?.message).toMatch(/skip_reason/);
    await ok(db.from("roadmap_node_state").insert({ student_id: student.userId, node_id: node, status: "SKIPPED", skip_reason: "Already know this" }).select("node_id"));
    const asStudent = await signedInClient(student.email, student.password);
    expect(((await untyped(asStudent).from("roadmap_node_state").select("status")).data ?? []).length).toBe(1);
    const other = await createThrowawayUserWithLogin(service, "p1-other");
    userIds.push(other.userId);
    const asOther = await signedInClient(other.email, other.password);
    expect(((await untyped(asOther).from("roadmap_node_state").select("status")).data ?? []).length).toBe(0);
  });

  it("diagnostic items need a reviewer to be published and are invisible to students", async () => {
    const item = { skill_id: activeSkillId, kind: "MCQ", difficulty: "easy", prompt: "zz live which clause filters rows?", options: ["WHERE", "GROUP BY"], answer_key: { correct: "WHERE" } };
    expect((await db.from("diagnostic_items").insert({ ...item, status: "PUBLISHED" })).error?.message).toMatch(/published_reviewed/);
    expect((await db.from("diagnostic_items").insert({ ...item, kind: "NUMERIC" })).error?.message).toMatch(/diagnostic_items_options/);
    await ok(db.from("diagnostic_items").insert({ ...item, status: "PUBLISHED", reviewed_by: reviewer }).select("id"));
    const asStudent = await signedInClient(student.email, student.password);
    expect((await untyped(asStudent).from("diagnostic_items").select("id")).error).not.toBeNull();
  });

  it("the inferred-mapping threshold is a setting, and logs and settings are service-only", async () => {
    expect(await getInferredMinConfidence(service)).toBe(0.8);
    await logAiCall(service, { feature: "zz-live-feature", userId: student.userId, status: "ok", model: "m", latencyMs: 120, usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }, meta: { node: "t-ok" } });
    const row = await ok(db.from("ai_call_log").select("*").eq("feature", "zz-live-feature").single());
    expect(row).toMatchObject({ status: "ok", latency_ms: 120, total_tokens: 15, cost_cents_estimate: null, meta: { node: "t-ok" } }); // no price configured: cost stays unknown
    const asStudent = await signedInClient(student.email, student.password);
    expect((await untyped(asStudent).from("ai_call_log").select("id")).error).not.toBeNull();
    expect((await untyped(asStudent).from("roadmap_settings").select("key")).error).not.toBeNull();
  });
});

describe("capability v2 (live)", () => {
  it("has no entry (no level) for a skill with no evidence, and explains the one that has", async () => {
    const empty = await loadStudentCapabilities(service, student.userId);
    expect(empty.bySkill.size).toBe(0);

    const now = new Date().toISOString();
    await ok(db.from("capabilities").insert({ user_id: student.userId, skill: "SQL", domain: "Data", capability_score: 60, confidence: "medium", data_points: 1 }).select("skill"));
    await ok(db.from("capability_history").insert({ user_id: student.userId, skill: "SQL", capability_score: 60, confidence: "medium", source: "initial_assessment", recorded_at: now }).select("skill"));
    for (const i of [1, 2]) {
      await ok(db.from("evidence").insert({ user_id: student.userId, skill: "SQL", source_type: "arena_challenge", evidence_type: "arena_result", source_identifier: `zz-p1:${student.userId}:${i}`, observed_at: now, confidence: "medium", metadata: { title: `Ticket ${i}`, score: 100 }, analysis_version: "t" }).select("id"));
    }
    const caps = await loadStudentCapabilities(service, student.userId);
    const sql = caps.bySkill.get(activeSkillId)!;
    expect(sql.level).toBe(60); // assessment 60 vs two fresh Arena passes worth 50: the higher stands
    expect(sql).toMatchObject({ verified: true, evidenceCount: 3, breakdown: { ASSESSMENT: 1, ARENA: 2 } });
    expect(sql.lines.map((l) => l.label).sort()).toEqual(["Arena: Ticket 1", "Arena: Ticket 2", "Capabilio assessment"]);
    expect(sql.formula).toMatchObject({ snapshotLevel: 60, practiceLevel: 50, version: "capability.v2" });
  });
});

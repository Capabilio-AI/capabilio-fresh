import { describe, expect, it } from "vitest";
import { evidenceFromRecord } from "@/lib/arena/attempt-evidence";
import { recordFromRow } from "./records";
import { sealEvidence, type SealInput } from "./seal";

const input: SealInput = {
  attemptId: "a1", userId: "u1", roleKey: "data-analyst", areaKey: "sql", areaName: "SQL", company: "BrightCart", skillIds: ["s1"], difficulty: "medium", toolType: "sql_workspace",
  title: "Revenue by city", requester: "Rohan · Sales", scenario: "Hi", objective: "Return one row per city\n`city`, `revenue`", submission: { query: "SELECT 1" },
  grade: { passed: true, message: "ok", checks: [{ label: "Result matches", passed: true }] }, submissions: 2, gradingVersion: "sql.grade.v1", generationVersion: "sql.gen.v1",
  assignedAt: "2026-11-01T10:00:00.000Z", completedAt: "2026-11-01T10:40:00.000Z", explained: true, explanationScore: 82,
};
const rowOf = (over: Record<string, unknown> = {}) => {
  const { content, fingerprint } = sealEvidence(input);
  return {
    attempt_id: "a1", user_id: "u1", role_key: content.roleKey, area_key: content.areaKey, area_name: content.areaName, company: content.company, skill_ids: content.skillIds, difficulty: content.difficulty,
    tool_type: content.toolType, title: content.title, requester: content.requester, scenario: content.scenario, objective: content.objective, submission: content.submission, grade: content.grade,
    submissions: content.submissions, grading_version: content.gradingVersion, generation_version: content.generationVersion, assigned_at: "2026-11-01T10:00:00+00:00", completed_at: "2026-11-01T10:40:00+00:00",
    explained: content.explained, explanation_score: content.explanationScore, schema_version: content.schemaVersion, fingerprint, shared: true, ...over,
  };
};

describe("sealed evidence record", () => {
  it("round-trips through the database row format and stays intact (timestamps come back in a different notation)", () => {
    expect(recordFromRow(rowOf() as never).intact).toBe(true);
  });

  it("is detected when any sealed column is altered in the database", () => {
    expect(recordFromRow(rowOf({ submission: { query: "SELECT 2" } }) as never).intact).toBe(false);
    expect(recordFromRow(rowOf({ grade: { passed: false, message: "no", checks: [] } }) as never).intact).toBe(false);
    expect(recordFromRow(rowOf({ explanation_score: 99 }) as never).intact).toBe(false);
  });

  it("does not treat the student's sharing choice as part of the seal", () => {
    expect(recordFromRow(rowOf({ shared: false }) as never).intact).toBe(true);
  });

  it("reads back as the evidence the popup already knows how to show, with the seal details", () => {
    const e = evidenceFromRecord(recordFromRow(rowOf() as never));
    expect(e.title).toBe("Revenue by city");
    expect(e.toolLabel).toBe("SQL workspace");
    expect(e.submissionText).toBe("SELECT 1");
    expect(e.objectiveLines).toEqual(["Return one row per city", "city, revenue"]);
    expect(e.seal).toMatchObject({ intact: true, explained: true, explanationScore: 82 });
    expect(e.seal?.fingerprint).toHaveLength(64);
    expect(JSON.stringify(e)).not.toMatch(/answer_key|expected/);
  });
});

describe("sealing a pass must never undo it", () => {
  it("swallows a failure (for example the table not existing yet) instead of throwing into the completion", async () => {
    const { sealAttemptEvidence } = await import("./records");
    const broken = { from: () => { throw new Error('relation "evidence_records" does not exist'); } };
    await expect(sealAttemptEvidence(broken as never, "a1")).resolves.toBeUndefined();
  });

  it("does nothing for an attempt that has no grade yet", async () => {
    const { sealAttemptEvidence } = await import("./records");
    const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: { id: "a1", grade: null } }) };
    const inserts: unknown[] = [];
    const svc = { from: (t: string) => (t === "evidence_records" ? { upsert: (r: unknown) => { inserts.push(r); return { error: null }; } } : chain) };
    await sealAttemptEvidence(svc as never, "a1");
    expect(inserts).toEqual([]);
  });
});

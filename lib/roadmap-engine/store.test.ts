import { describe, expect, it } from "vitest";
import { generateRoadmap } from "./generate";
import { toPayload } from "./store";
import { buildSnapshot, type PreparedRoadmap } from "./prepare";
import { hashSnapshot } from "./snapshot";
import type { EngineInput } from "./types";
import type { LoadedMeta } from "./load";

const S = "11111111-1111-4111-8111-111111111111";
const SQL = "22222222-2222-4222-8222-222222222222";
const DBMS = "33333333-3333-4333-8333-333333333333";
const input: EngineInput = {
  career: { id: "44444444-4444-4444-8444-444444444444", name: "Data Analyst" },
  requirements: [{ skillId: SQL, skillName: "SQL", importance: "CRITICAL", targetLevel: 80, stage: "FOUNDATION", parentSkillId: null }],
  courses: [{ id: DBMS, title: "DBMS", year: 3, semester: 1, skills: [{ skillId: SQL, importance: "CORE", outcomeCount: 2 }], prerequisiteCourseIds: [] }],
  capability: { [SQL]: { level: 38, confidence: 0.7, verified: true, verifiedLevel: 38, selfDeclaredLevel: null } }, hasAnyCapabilityData: true,
  position: { year: 3, semester: 1, totalYears: 4 }, student: { id: S, institutionId: "55555555-5555-4555-8555-555555555555" },
  catalogs: { learning: [], certifications: [], projects: [], arena: [] },
};
const meta: LoadedMeta = { mode: "STANDARD", institutionId: input.student.institutionId!, branchKey: "cse", regulation: "R23", curriculumVersionId: "66666666-6666-4666-8666-666666666666", goals: [{ kind: "PRIMARY", careerId: input.career.id, careerName: "Data Analyst", readiness: 40 }], semesterEstimated: true, unmatchedCapabilities: ["Odd Skill"], allSkillNames: ["SQL"] };
const prepared = (): PreparedRoadmap => {
  const snapshot = buildSnapshot(input, meta);
  return { status: "READY", plan: generateRoadmap(input), input, meta, snapshot, hash: hashSnapshot(snapshot), explanations: new Map([[DBMS, "This subject builds SQL."]]), explanationNotes: { rejected: 1, failed: false } };
};

describe("toPayload (what the database function receives)", () => {
  const p = toPayload(prepared(), "PROGRESS_UPDATE") as Record<string, any>;
  it("carries the student, career, curriculum version, trigger, hash and readiness from the prepared roadmap", () => {
    expect(p).toMatchObject({ student_id: S, career_id: input.career.id, curriculum_version_id: meta.curriculumVersionId, branch_key: "cse", trigger: "PROGRESS_UPDATE", mode: "STANDARD", baseline: false });
    expect(p.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(p.readiness).toBe(prepared().plan.readiness);
    expect(p.snapshot).toEqual(prepared().snapshot);
  });
  it("stores gaps with their numbers, courses with the grounded sentence, goals, milestones — all in snake_case", () => {
    expect(p.gaps[0]).toMatchObject({ skill_id: SQL, skill_name: "SQL", target_level: 80, current_level: 38, gap: 42, coverage: "STRONG", gap_type: "COVERED_BY_CURRICULUM", sort_order: 0 });
    expect(p.courses[0]).toMatchObject({ course_id: DBMS, title: "DBMS", schedule: "CURRENT", ai_explanation: "This subject builds SQL.", sort_order: 0 });
    expect(p.courses[0].facts).toEqual({ skillIds: [SQL], skillNames: ["SQL"], outcomeCount: 2, gapPoints: 42 });
    expect(p.goals).toEqual([{ kind: "PRIMARY", career_id: input.career.id, career_name: "Data Analyst", readiness: 40 }]);
    expect(p.milestones.map((m: { kind: string }) => m.kind)).toEqual(expect.arrayContaining(["COURSE", "SKILL"]));
    expect(p.milestones.every((m: { sort_order: number }, i: number) => m.sort_order === i)).toBe(true);
  });
  it("records the honest notes and the semester caveat with the version", () => {
    expect(p.notes).toMatchObject({ semesterEstimated: true, unmatchedCapabilities: ["Odd Skill"], explanationsRejected: 1, certificationNote: "Certification recommendation not configured yet." });
    expect(p.notes.mandatoryNote).toMatch(/remain part of your academic curriculum/);
    expect(p.next_best_action).toMatchObject({ kind: "COURSE" });
  });
  it("a course with no AI sentence stores NULL, never an empty string", () => {
    const x = prepared();
    x.explanations = new Map();
    expect((toPayload(x, "MANUAL") as Record<string, any>).courses[0].ai_explanation).toBeNull();
  });
});

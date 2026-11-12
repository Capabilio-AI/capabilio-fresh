import { writeFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startNextAttempt, submitAttempt, finishVerified } from "@/lib/arena-workstations/attempts";
import { createThrowawayUser, deleteThrowawayUser, liveServiceClient } from "@/lib/arena-workstations/live-test-helpers";
import { referenceSubmission } from "@/lib/arena-workstations/reference-submission";
import { untyped } from "@/lib/org/db";
import { saveCareerIntent } from "@/lib/careers/intent";
import { loadStudentCapabilities } from "@/lib/capability/read-model";
import { getRoadmapGraph } from "@/lib/roadmap-visual/service";
import { ML_ENGINEER_DEVOPS_TEMPLATES } from "@/lib/workplace/ml-engineer/devops-templates";
import { AI_ML_ENGINEER } from "./blueprints/ai-ml-engineer";

// Live: a throwaway student whose target career is AI/ML Engineer works every skill area through the real attempt flow, then we read back what the
// platform now believes about them: rating, evidence, capability per skill, career readiness and the roadmap. AI generation is off so the fixed templates
// (what ships as the safety net) are what is exercised. Run: LIVE_DB=1 npx vitest run lib/arena-roles/ai-ml-e2e.live.test.ts
const service = liveServiceClient();
const db = untyped(service);
let userId = "";
const report: Record<string, unknown>[] = [];
const before = process.env.ML_AI_GENERATION;

// pipeline-debugging is held back until junior, so a fresher is served the rest
const AREAS = AI_ML_ENGINEER.areas.filter((a) => a.status === "enabled" && a.areaKey !== "pipeline-debugging").map((a) => a.areaKey);

const skipCooldown = () => service.from("arena_domain_assignments").update({ next_available_at: new Date(Date.now() - 1000).toISOString() }).eq("user_id", userId);

beforeAll(async () => {
  process.env.ML_AI_GENERATION = "off";
  process.env.CODE_AI_GENERATION = "off";
  process.env.DEVOPS_AI_GENERATION = "off";
  userId = await createThrowawayUser(service, "aiml");
  const careers = Object.fromEntries(((await service.from("careers").select("id, key")).data ?? []).map((c) => [c.key, c.id]));
  await saveCareerIntent(service, userId, { primaryCareerId: careers["ai-ml-engineer"], secondaryCareerId: null, isExploring: false });
}, 60_000);

afterAll(async () => {
  if (before === undefined) delete process.env.ML_AI_GENERATION; else process.env.ML_AI_GENERATION = before;
  await deleteThrowawayUser(service, userId);
});

describe("AI/ML Engineer end to end", () => {
  it("serves, grades, rates and records evidence for every area, and the skill graph and readiness move", async () => {
    const { data: career } = await service.from("careers").select("id").eq("key", "ai-ml-engineer").single();
    const latestReadiness = async () => (await db.from("career_skill_graph_snapshots").select("readiness, created_at").eq("student_id", userId).eq("career_id", career!.id).order("created_at", { ascending: false }).limit(1).maybeSingle()).data?.readiness ?? 0;
    const readinessBefore = await latestReadiness();
    const graphBefore = await getRoadmapGraph(service, userId, "primary");
    const capsBefore = await loadStudentCapabilities(service, userId);

    for (const areaKey of AREAS) {
      const started = await startNextAttempt(service, userId, "AI/ML Engineer", areaKey);
      expect(started.state, areaKey).toBe("active");
      if (started.state !== "active") return;
      const { attempt } = started;
      expect(attempt.area.key, areaKey).toBe(areaKey);
      const { data: instance } = await service.from("arena_challenges").select("answer_key, content, tool_type, title, skill_tags").eq("id", attempt.challenge.id).single();
      const tool = instance!.tool_type!;

      const reference = tool === "devops_workspace"
        ? { files: ML_ENGINEER_DEVOPS_TEMPLATES.find((t) => t.draft.title === instance!.title)!.solution }
        : referenceSubmission(tool, instance!.content, instance!.answer_key);
      const right = await submitAttempt(service, userId, attempt.attemptId, reference);
      expect(right.passed, `${areaKey}: reference answer (${instance!.title})`).toBe(true);
      await finishVerified(service, userId, attempt.attemptId);

      const { data: rating } = await service.from("arena_skill_ratings").select("rating, verified_count").eq("user_id", userId).eq("area_key", areaKey).single();
      const { data: evidence } = await service.from("evidence").select("skill, metadata").eq("user_id", userId).eq("source_identifier", `arena-attempt:${attempt.attemptId}`);
      expect(evidence, `${areaKey}: one evidence row`).toHaveLength(1);
      report.push({ area: areaKey, tool, title: instance!.title, rating: rating!.rating, evidenceSkill: evidence![0].skill });
      await skipCooldown();
    }

    const capsAfter = await loadStudentCapabilities(service, userId);
    const { data: skills } = await service.from("skills").select("id, name");
    const nameOf = new Map((skills ?? []).map((s) => [s.id, s.name]));
    const moved = [...capsAfter.bySkill].map(([id, c]) => ({ skill: nameOf.get(id), level: c.level, evidence: c.evidenceCount, confidence: c.confidence })).sort((a, b) => (b.level ?? 0) - (a.level ?? 0));
    const readinessAfter = await latestReadiness();
    const { data: scores } = await db.from("student_skill_scores").select("skill_id, score, confidence, evidence_count").eq("student_id", userId);
    const { data: evidenceRows } = await db.from("student_skill_evidence").select("skill_id").eq("student_id", userId);
    const { data: lastSnap } = await db.from("career_skill_graph_snapshots").select("readiness, skills").eq("student_id", userId).eq("career_id", career!.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const { data: snapshots } = await db.from("career_skill_graph_snapshots").select("readiness").eq("student_id", userId).eq("career_id", career!.id);
    const graphScores = ((scores ?? []) as { skill_id: string; score: number; evidence_count: number }[]).map((r) => ({ skill: nameOf.get(r.skill_id), score: r.score, evidence: r.evidence_count })).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const graphAfter = await getRoadmapGraph(service, userId, "primary");

    writeFileSync(process.env.AIML_REPORT ?? "/tmp/claude-501/aiml-e2e-report.json", JSON.stringify({
      perArea: report,
      skillsAfter: moved,
      skillsBeforeCount: capsBefore.bySkill.size,
      graphScores, lastSnapshot: lastSnap, evidenceRows: evidenceRows?.length, snapshots: (snapshots as { readiness: number }[] | null)?.map((x) => x.readiness),
      careerReadiness: { before: readinessBefore, after: readinessAfter },
      roadmap: { before: graphBefore.ok ? graphBefore.graph.header : graphBefore.reason, after: graphAfter.ok ? graphAfter.graph.header : graphAfter.reason },
    }, null, 1));

    // every area proves its primary skill, and most prove extra ones too: those extra rows are written under valid uuid keys
    expect(evidenceRows?.length ?? 0).toBeGreaterThan(AREAS.length);
    expect(capsAfter.bySkill.size).toBeGreaterThan(capsBefore.bySkill.size);
    expect(moved.filter((m) => (m.level ?? 0) > 0).length).toBeGreaterThanOrEqual(5);
    expect(readinessAfter).toBeGreaterThan(readinessBefore);
  }, 600_000);
});

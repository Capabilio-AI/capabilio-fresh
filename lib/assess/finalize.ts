// Submit: turns a fully answered session into the result the UI renders (skill graph, readiness, ELO summary, general bars),
// persists an append-only skill-graph snapshot, feeds the existing capability/roadmap pipeline, and advances onboarding.
// Idempotent: submitting twice returns the stored result and writes nothing again.

import { buildSectionBars, buildSkillResults, computeReadiness, highlights, nextBestAction, summariseElo, type RoleSkill } from "./scoring";
import { advanceOnboarding, loadCareer, loadCareerSkills, track, type Db } from "./db";
import type { Obs } from "./engine";
import { GENERAL_SECTIONS } from "./general";
import { loadSession } from "./session";
import { AssessError, type AssessmentResult } from "./types";

const CONFIDENCE_TO_LEGACY = { HIGH: "high", MEDIUM: "medium", LOW: "low" } as const;

async function sessionObsBySection(db: Db, sessionId: string): Promise<Record<string, Obs[]>> {
  const { data, error } = await db
    .from("assess_responses")
    .select("is_correct, sq:assess_session_questions(pool:assess_question_pool(section, difficulty))")
    .eq("session_id", sessionId);
  if (error) throw error;
  type Row = { is_correct: boolean; sq: { pool: { section: string; difficulty: Obs["difficulty"] } | { section: string; difficulty: Obs["difficulty"] }[] } | { pool: { section: string; difficulty: Obs["difficulty"] } }[] | null };
  const out: Record<string, Obs[]> = {};
  for (const r of (data ?? []) as unknown as Row[]) {
    const sq = Array.isArray(r.sq) ? r.sq[0] : r.sq;
    const pool = Array.isArray(sq?.pool) ? sq.pool[0] : sq?.pool;
    if (pool) (out[pool.section] ??= []).push({ difficulty: pool.difficulty, correct: r.is_correct });
  }
  return out;
}

export async function submitSession(db: Db, userId: string, sessionId: string): Promise<AssessmentResult> {
  const session = await loadSession(db, userId, sessionId);
  if (session.status === "COMPLETED" && session.result) return session.result as AssessmentResult;

  const { count } = await db.from("assess_responses").select("id", { count: "exact", head: true }).eq("session_id", sessionId);
  if ((count ?? 0) < session.total_questions) {
    throw new AssessError("NOT_ALL_ANSWERED", `Answer all ${session.total_questions} questions before submitting.`, 409);
  }

  const result = session.layer === "GENERAL" ? await buildGeneralResult(db, sessionId) : await buildCareerResult(db, userId, session);
  // The snapshot and scores are written BEFORE the session is marked complete and are idempotent (one snapshot per
  // session), so a crash in between leaves a retryable submit rather than a "completed" session with no outcome.
  if (session.layer === "CAREER") await persistSnapshot(db, userId, sessionId, result);

  // Claim the finalisation. If a parallel submit won, hand back what it stored instead of writing twice.
  const { data: claimed } = await db
    .from("assess_sessions")
    .update({ status: "COMPLETED", completed_at: result.completedAt, result })
    .eq("id", sessionId)
    .eq("status", "IN_PROGRESS")
    .select("id")
    .maybeSingle();
  if (!claimed) return (await loadSession(db, userId, sessionId)).result as AssessmentResult;

  if (session.layer === "GENERAL") {
    await advanceOnboarding(db, userId, "COMMON_ASSESSMENT_COMPLETE");
    for (const bar of result.general ?? []) await track(db, userId, "common_section_completed", { sessionId, section: bar.section, score: bar.score });
  } else {
    await feedCapabilities(db, userId, result);
    await advanceOnboarding(db, userId, "PROFILE_READY");
    await track(db, userId, "career_assessment_completed", { sessionId, careerId: result.career?.id, readiness: result.readiness, elo: result.elo?.newElo });
  }
  return result;
}

async function buildGeneralResult(db: Db, sessionId: string): Promise<AssessmentResult> {
  const bars = buildSectionBars(GENERAL_SECTIONS.map((g) => ({ key: g.section, label: g.label })), await sessionObsBySection(db, sessionId));
  return {
    layer: "GENERAL", completedAt: new Date().toISOString(), career: null, elo: null, readiness: null, coverage: null,
    skills: [], strongest: [], focusAreas: [], notYetMeasured: [], nextBestAction: null, general: bars,
  };
}

/**
 * The role's skill graph from ALL the student's evidence (assessments and Arena): the capability graph is shared across roles,
 * so SQL evidence from one role counts toward every role that needs SQL, while each role's ELO stays independent.
 */
export async function computeSkillGraph(db: Db, userId: string, careerId: string) {
  const skills = await loadCareerSkills(db, careerId);
  const { data: ev, error } = await db.from("student_skill_evidence").select("skill_id, correct, difficulty").eq("student_id", userId).in("skill_id", skills.map((s) => s.skillId));
  if (error) throw error;
  const bySkill: Record<string, Obs[]> = {};
  for (const e of ev ?? []) (bySkill[e.skill_id] ??= []).push({ difficulty: e.difficulty, correct: e.correct });
  const results = buildSkillResults(skills as RoleSkill[], bySkill);
  return { results, ...computeReadiness(results), highlights: highlights(results) };
}

async function buildCareerResult(db: Db, userId: string, session: { id: string; career_id: string | null; starting_elo: number | null }): Promise<AssessmentResult> {
  const career = session.career_id ? await loadCareer(db, session.career_id) : null;
  if (!career) throw new AssessError("CAREER_REQUIRED", "That career is no longer available.", 409);
  const { results, readiness, coverage, highlights: h } = await computeSkillGraph(db, userId, career.id);

  const { data: resp } = await db.from("assess_responses").select("elo_event_id").eq("session_id", session.id);
  const eventIds = (resp ?? []).map((r) => r.elo_event_id).filter((id): id is string => !!id);
  const { data: events } = eventIds.length ? await db.from("elo_events").select("change").in("id", eventIds) : { data: [] as { change: number }[] };
  const elo = summariseElo(session.starting_elo ?? 400, events ?? []);

  // the general profile is shown beside the career radar, but it is a different layer and is never combined with it
  const { data: general } = await db.from("assess_sessions").select("result").eq("student_id", userId).eq("layer", "GENERAL").eq("status", "COMPLETED").order("completed_at", { ascending: false }).limit(1).maybeSingle();

  return {
    layer: "CAREER", completedAt: new Date().toISOString(), career, elo, readiness, coverage, skills: results,
    strongest: h.strongest, focusAreas: h.focusAreas, notYetMeasured: h.notYetMeasured, nextBestAction: nextBestAction(h),
    general: (general?.result as AssessmentResult | undefined)?.general ?? null,
  };
}

/** Skill scores plus the append-only snapshot (unique per session, so a retry cannot duplicate history). */
async function persistSnapshot(db: Db, userId: string, sessionId: string, result: AssessmentResult): Promise<void> {
  const now = new Date().toISOString();
  const { error: scoreError } = await db.from("student_skill_scores").upsert(
    result.skills.map((s) => ({ student_id: userId, skill_id: s.skillId, score: s.score, confidence: s.confidence, evidence_count: s.evidenceCount, updated_at: now })),
    { onConflict: "student_id,skill_id" }
  );
  if (scoreError) throw scoreError;

  const { error: snapError } = await db.from("career_skill_graph_snapshots").upsert({
    student_id: userId, career_id: result.career!.id, session_id: sessionId, trigger: "ASSESSMENT",
    elo: result.elo!.newElo, readiness: result.readiness!,
    skills: result.skills.map((s) => ({ skillId: s.skillId, key: s.key, name: s.name, score: s.score, confidence: s.confidence, evidenceCount: s.evidenceCount, importance: s.importance, targetLevel: s.targetLevel })),
  }, { onConflict: "session_id", ignoreDuplicates: true });
  if (snapError) throw snapError;
}

/** Feeds the capability pipeline (capabilities + capability_history) that the roadmap engine and dashboard already read. */
async function feedCapabilities(db: Db, userId: string, result: AssessmentResult): Promise<void> {
  const measured = result.skills.filter((s) => s.score !== null && s.confidence !== "INSUFFICIENT");
  if (measured.length > 0) {
    await db.from("capabilities").upsert(
      measured.map((s) => ({ user_id: userId, skill: s.name, domain: s.category ?? "General", capability_score: s.score!, confidence: CONFIDENCE_TO_LEGACY[s.confidence as keyof typeof CONFIDENCE_TO_LEGACY], data_points: s.evidenceCount })),
      { onConflict: "user_id,skill" }
    );
    await db.from("capability_history").insert(
      measured.map((s) => ({ user_id: userId, skill: s.name, capability_score: s.score!, confidence: CONFIDENCE_TO_LEGACY[s.confidence as keyof typeof CONFIDENCE_TO_LEGACY], source: "initial_assessment" })),
    );
    for (const s of measured) void track(db, userId, "skill_estimated", { skillId: s.skillId, score: s.score, confidence: s.confidence });
  }
}

/** The most recent finished result for the student's role (or any, when no career is given). */
export async function latestResult(db: Db, userId: string, layer: "GENERAL" | "CAREER", careerId?: string): Promise<AssessmentResult | null> {
  let q = db.from("assess_sessions").select("result").eq("student_id", userId).eq("layer", layer).eq("status", "COMPLETED").order("completed_at", { ascending: false }).limit(1);
  if (careerId) q = q.eq("career_id", careerId);
  const { data } = await q.maybeSingle();
  return (data?.result as AssessmentResult | undefined) ?? null;
}

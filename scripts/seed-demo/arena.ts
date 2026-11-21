// DEMO DATA. Writes a student's Arena history: each ticket is created as an inactive demo challenge and an assignment, completed through the same
// code a real pass or miss uses (rating, role ELO, skill graph, evidence, sealed record), then its dates are moved back to when it "happened".
import { randomUUID } from "node:crypto";
import { recordArenaMiss, recordArenaPass } from "@/lib/assess/arena";
import { missChange } from "@/lib/assess/arena-rules";
import { ARENA_BASE_DELTA, ARENA_DIFFICULTY_SCALE } from "@/lib/assess/arena-rules";
import { sealEvidence } from "@/lib/evidence/seal";
import { ELO_BY_DIFFICULTY } from "@/lib/arena-workstations/types";
import { buildTasks, type TaskSpec } from "./arena-bank";
import { rngFor } from "./rng";
import { AREA_SKILLS } from "./skills";

type Db = any;
const DAY = 864e5;

/** Removes what an earlier run wrote for this student, so a re-run starts clean. The append-only skill graph snapshots stay. */
async function clearEarlierRun(db: Db, userId: string, slug: string, careerId: string, startingElo: number) {
  const { data: assignments } = await db.from("arena_domain_assignments").select("id").eq("user_id", userId);
  const ids = ((assignments ?? []) as { id: string }[]).map((a) => a.id);
  if (ids.length) {
    await db.from("evidence_records").delete().in("attempt_id", ids);
    await db.from("arena_task_interviews").delete().in("attempt_id", ids);
    await db.from("arena_attempt_completions").delete().in("attempt_id", ids);
    await db.from("elo_events").delete().in("source_id", ids);
    for (const id of ids) await db.from("student_skill_evidence").delete().like("source_id", `${id}%`);
    
    await db.from("arena_domain_assignments").delete().in("id", ids);
  }
  await db.from("arena_challenge_completions").delete().eq("user_id", userId);
  await db.from("evidence").delete().eq("user_id", userId).eq("source_type", "arena_challenge");
  await db.from("arena_skill_ratings").delete().eq("user_id", userId);
  await db.from("arena_domain_stats").delete().eq("user_id", userId);
  await db.from("arena_challenges").delete().eq("source_notes", `demo:${slug}`);
  await db.from("student_career_elo").upsert({ student_id: userId, career_id: careerId, rating: startingElo }, { onConflict: "student_id,career_id" });
}

/** The role's skills a ticket exercises, found by name among the career's own skills. */
async function skillsOf(db: Db, careerId: string, areaKey: string, rotate: number) {
  const { data } = await db.from("career_skill_requirements").select("skill_id, skills!inner(name)").eq("career_id", careerId);
  const byName = new Map(((data ?? []) as { skill_id: string; skills: { name: string } }[]).map((r) => [r.skills.name, r.skill_id]));
  const found = (AREA_SKILLS[areaKey] ?? []).flatMap((n) => (byName.has(n) ? [byName.get(n) as string] : []));
  // the product records the first skill of a ticket, so which one comes first rotates and proof spreads across the area's skills
  const ids = found.length ? [...found.slice(rotate % found.length), ...found.slice(0, rotate % found.length)] : [];
  return { skillId: (ids[0] ?? null) as string | null, extraSkillIds: ids.slice(1) };
}

async function createTicket(db: Db, slug: string, userId: string, t: TaskSpec, index: number, closedAt: Date) {
  const assignedAt = new Date(closedAt.getTime() - (t.minutes + 4) * 60e3);
  const { data: ch, error: chError } = await db.from("arena_challenges").insert({
    track: "domain", scope_key: t.roleKey, title: t.title, category: t.areaKey, difficulty: t.difficulty, scenario: t.scenario, objective: t.objective.join("\n"),
    language: "python", expected_output: "", requester: t.requester, skill_area_key: t.areaKey, tool_type: t.toolType, content: { company: t.company },
    grading_version: "demo-1", generation_version: "demo-1", active: false, est_minutes: t.minutes, source_notes: `demo:${slug}`, created_at: assignedAt.toISOString(),
  }).select("id").single();
  if (chError) throw chError;
  const id = randomUUID();
  const { error } = await db.from("arena_domain_assignments").insert({
    id, user_id: userId, role_key: t.roleKey, challenge_id: ch.id, skill_area_key: t.areaKey, cycle_number: Math.floor(index / 6) + 1, status: "presented",
    assigned_at: assignedAt.toISOString(), time_spent_seconds: t.minutes * 60,
  });
  if (error) throw error;
  return { id, challengeId: ch.id as string, assignedAt, index };
}

const gradeJson = (t: TaskSpec) => ({ passed: t.passed, message: t.message, checks: t.checks, detail: null, grading_version: "demo-1" });

async function closePass(db: Db, userId: string, careerId: string, t: TaskSpec, ticket: { id: string; challengeId: string; assignedAt: Date; index: number }, closedAt: Date) {
  const grade = gradeJson(t);
  const submission = { query: t.code };
  await db.from("arena_domain_assignments").update({ status: "explaining", grade, submission, submitted_at: closedAt.toISOString(), submission_count: 1 }).eq("id", ticket.id);
  const points = ELO_BY_DIFFICULTY[t.difficulty];
  const { error } = await db.rpc("complete_workstation_attempt", { p_attempt_id: ticket.id, p_grade: grade, p_submission: submission, p_points: points, p_streak: { current_streak: 1, longest_streak: 1, last_completed_week: null }, p_cooldown_hours: 24 });
  if (error) throw error;
  const iso = closedAt.toISOString();
  await db.from("arena_domain_assignments").update({ assigned_at: ticket.assignedAt.toISOString(), submitted_at: iso, completed_at: iso, next_available_at: new Date(closedAt.getTime() + DAY).toISOString() }).eq("id", ticket.id);
  await db.from("arena_attempt_completions").update({ completed_at: iso }).eq("attempt_id", ticket.id);
  await db.from("arena_challenge_completions").update({ completed_at: iso }).eq("user_id", userId).eq("challenge_id", ticket.challengeId);
  await db.from("evidence").update({ observed_at: iso }).eq("user_id", userId).eq("source_identifier", `arena-attempt:${ticket.id}`);
  const skills = await skillsOf(db, careerId, t.areaKey, ticket.index);
  await recordArenaPass(userId, { attemptId: ticket.id, roleKey: t.roleKey, ...skills, difficulty: t.difficulty }, db);
  await db.from("elo_events").update({ created_at: iso }).eq("source_id", ticket.id);
  await db.from("student_skill_evidence").update({ created_at: iso }).like("source_id", `${ticket.id}%`);
  await db.from("arena_task_interviews").insert({
    attempt_id: ticket.id, user_id: userId, attempts: 1, questions: t.interview.questions, asked: t.interview.questions, answers: t.interview.answers, score: t.interview.score,
    feedback: { strengths: t.interview.strengths, improvements: t.interview.improvements, notes: t.interview.notes }, passed: t.interview.passed, created_at: iso, updated_at: iso,
  });
  const { data: area } = await db.from("arena_skill_areas").select("display_name").eq("role_key", t.roleKey).eq("area_key", t.areaKey).maybeSingle();
  const { content, fingerprint } = sealEvidence({
    attemptId: ticket.id, userId, roleKey: t.roleKey, areaKey: t.areaKey, areaName: area?.display_name ?? t.areaKey, company: t.company,
    skillIds: [skills.skillId, ...skills.extraSkillIds].filter((x): x is string => Boolean(x)), difficulty: t.difficulty, toolType: t.toolType, title: t.title,
    requester: t.requester, scenario: t.scenario, objective: t.objective.join("\n"), submission, grade, submissions: 1, gradingVersion: "demo-1", generationVersion: "demo-1",
    assignedAt: ticket.assignedAt.toISOString(), completedAt: iso, explained: t.interview.passed, explanationScore: t.interview.passed ? t.interview.score : null,
  });
  const { error: sealError } = await db.from("evidence_records").upsert({
    attempt_id: ticket.id, user_id: userId, role_key: content.roleKey, area_key: content.areaKey, area_name: content.areaName, company: content.company, skill_ids: content.skillIds,
    difficulty: content.difficulty, tool_type: content.toolType, title: content.title, requester: content.requester, scenario: content.scenario, objective: content.objective,
    submission: content.submission, grade: content.grade, submissions: content.submissions, grading_version: content.gradingVersion, generation_version: content.generationVersion,
    assigned_at: content.assignedAt, completed_at: content.completedAt, explained: content.explained, explanation_score: content.explanationScore, schema_version: content.schemaVersion,
    fingerprint, shared: true, created_at: iso,
  }, { onConflict: "attempt_id" });
  if (sealError) throw sealError;
}

async function closeMiss(db: Db, userId: string, careerId: string, t: TaskSpec, ticket: { id: string; challengeId: string; assignedAt: Date; index: number }, closedAt: Date) {
  const grade = gradeJson(t);
  const iso = closedAt.toISOString();
  await db.from("arena_domain_assignments").update({ status: "unexplained", grade, submission: { query: t.code }, submitted_at: iso, submission_count: 1, completed_at: iso, next_available_at: new Date(closedAt.getTime() + DAY).toISOString() }).eq("id", ticket.id);
  const area = missChange(ELO_BY_DIFFICULTY[t.difficulty], t.checks);
  const career = missChange(ARENA_BASE_DELTA * ARENA_DIFFICULTY_SCALE[t.difficulty], t.checks);
  const skills = await skillsOf(db, careerId, t.areaKey, ticket.index);
  await recordArenaMiss(userId, { attemptId: ticket.id, roleKey: t.roleKey, areaChange: area, careerChange: career, reason: `Arena ${t.difficulty} challenge: not every check passed`, difficulty: t.difficulty, ...skills }, db);
  await db.from("elo_events").update({ created_at: iso }).eq("source_id", ticket.id);
  await db.from("student_skill_evidence").update({ created_at: iso }).like("source_id", `${ticket.id}%`);
}

/** The student's Arena history: `count` tickets over about 11 weeks, in order. Returns how many were passed and missed. */
export async function seedArena(db: Db, d: { slug: string; roleKey: TaskSpec["roleKey"] }, userId: string, careerId: string, startingElo: number, count: number) {
  await clearEarlierRun(db, userId, d.slug, careerId, startingElo);
  const tasks = buildTasks(d.slug, d.roleKey, count);
  const rng = rngFor("arena-time", d.slug);
  const now = Date.now();
  let passed = 0;
  let missed = 0;
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    const closedAt = new Date(now - t.daysAgo * DAY - Math.round(rng() * 6) * 3600e3);
    const ticket = await createTicket(db, d.slug, userId, t, i, closedAt);
    if (t.passed) { await closePass(db, userId, careerId, t, ticket, closedAt); passed++; } else { await closeMiss(db, userId, careerId, t, ticket, closedAt); missed++; }
  }
  // the weekly streak and totals the Arena page shows; the completion function only knows "this week"
  const week = new Date(); week.setUTCDate(week.getUTCDate() - ((week.getUTCDay() + 6) % 7));
  await db.from("arena_domain_stats").upsert({ user_id: userId, points: tasks.filter((t) => t.passed).reduce((n, t) => n + ELO_BY_DIFFICULTY[t.difficulty], 0), tasks_completed: passed, current_streak: 5, longest_streak: 8, last_completed_week: week.toISOString().slice(0, 10), updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  const { data: ratings } = await db.from("arena_skill_ratings").select("area_key").eq("user_id", userId);
  for (const r of (ratings ?? []) as { area_key: string }[]) {
    const last = tasks.filter((t) => t.passed && t.areaKey === r.area_key).reduce((m, t) => Math.min(m, t.daysAgo), 999);
    if (last < 999) await db.from("arena_skill_ratings").update({ last_verified_at: new Date(now - last * DAY).toISOString() }).eq("user_id", userId).eq("area_key", r.area_key);
  }
  return { passed, missed };
}

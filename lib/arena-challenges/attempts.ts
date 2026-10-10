import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { getCareerIntent } from "@/lib/careers/intent";
import { RUNTIMES } from "@/lib/arena-runtime/registry";
import { evaluateRuntimeGate, loadRuntimeSetting, loadStudentUsageToday } from "@/lib/arena-runtime/gate";
import type { RuntimeType } from "@/lib/arena-runtime/types";
import { runSqlQueries } from "@/lib/arena-workstations/engines/sql-runner";
import { advanceStreak } from "./streak";
import { currentStreamWeek, currentWeekStart } from "./week";
import { MAX_DRAFT_BYTES, expiresAtFor, hintPenalty, isFinal, isPastDeadline, timeSpentSeconds, type AttemptStatus } from "./attempt-state";
import { SubmissionSchema, type CheckRow, type RunSql } from "./checks";
import { GRADING_VERSION, gradeAttempt } from "./grade";
import type { Db } from "@/lib/assess/db";
import { AI_HELP_PENALTY, MAX_AI_HELP } from "./ai-help-rules";

type Service = SupabaseClient<Database>;

export class ChallengeAttemptError extends Error {
  constructor(message: string, readonly status: number, readonly extra: Record<string, unknown> = {}) {
    super(message);
  }
}

interface ChallengeRow {
  id: string;
  track: "stream" | "domain";
  scope_key: string;
  title: string;
  difficulty: string;
  est_minutes: number | null;
  time_limit_minutes: number;
  ticket_brief: string | null;
  workstation_template_id: string | null;
  starter_assets_ref: Record<string, unknown> | null;
}
interface AttemptRow {
  id: string;
  student_id: string;
  challenge_id: string;
  status: AttemptStatus;
  started_at: string;
  expires_at: string;
  hints_used: number;
  ai_help_uses: number;
  runtime_type: RuntimeType;
  draft: unknown;
  score: number | null;
  checks_passed: number | null;
  checks_total: number | null;
  check_results: PublicCheckResult[] | null;
  evidence_status: string | null;
  points_awarded: number | null;
  elo_delta: number | null;
}
export interface PublicCheckResult {
  checkId?: string;
  stepId: string | null;
  label: string;
  visible: boolean;
  passed: boolean;
}
export interface AttemptResult {
  status: AttemptStatus;
  score: number;
  checksPassed: number;
  checksTotal: number;
  results: PublicCheckResult[];
  evidenceStatus: string | null;
  pointsAwarded: number;
  eloDelta: number;
  message: string;
}

const CHALLENGE_COLUMNS = "id, track, scope_key, title, difficulty, est_minutes, time_limit_minutes, ticket_brief, workstation_template_id, starter_assets_ref";
const ATTEMPT_COLUMNS = "id, student_id, challenge_id, status, started_at, expires_at, hints_used, ai_help_uses, runtime_type, draft, score, checks_passed, checks_total, check_results, evidence_status, points_awarded, elo_delta";

const GATE_MESSAGE = {
  RUNTIME_NOT_AVAILABLE: [409, "This workstation isn't available yet."],
  RUNTIME_DISABLED: [403, "This workstation is temporarily switched off."],
  DAILY_ATTEMPT_LIMIT: [429, "You've reached today's attempt limit for this kind of workstation. Come back tomorrow."],
  DAILY_COST_LIMIT: [429, "You've reached today's usage limit for this workstation. Come back tomorrow."],
} as const;

export async function loadChallenge(service: Service, challengeId: string): Promise<ChallengeRow> {
  const { data } = await untyped(service).from("arena_challenges").select(CHALLENGE_COLUMNS).eq("id", challengeId).eq("status", "PUBLISHED").is("user_id", null).maybeSingle();
  if (!data) throw new ChallengeAttemptError("Challenge not found.", 404);
  return data as ChallengeRow;
}

export async function loadOwnAttempt(service: Service, userId: string, attemptId: string): Promise<AttemptRow> {
  const { data } = await untyped(service).from("challenge_attempts").select(ATTEMPT_COLUMNS).eq("id", attemptId).eq("student_id", userId).maybeSingle();
  if (!data) throw new ChallengeAttemptError("Attempt not found.", 404);
  return data as AttemptRow;
}

/** A student may only open a challenge that is theirs to do: a Domain one linked to their primary/Plan B career, a Stream one in this week's batch. */
async function assertEligible(service: Service, userId: string, challenge: ChallengeRow): Promise<void> {
  const db = untyped(service);
  if (challenge.track === "domain") {
    const { intent } = await getCareerIntent(service, userId);
    const mine = [intent.primary?.id, intent.secondary?.id].filter((id): id is string => Boolean(id));
    const { data } = mine.length ? await db.from("challenge_careers").select("career_id").eq("challenge_id", challenge.id).in("career_id", mine) : { data: [] };
    if (!data?.length) throw new ChallengeAttemptError("This challenge isn't part of your target career.", 403);
    return;
  }
  const { data: week } = await service.from("arena_stream_weeks").select("challenge_ids").eq("user_id", userId).eq("week_start", currentStreamWeek()).maybeSingle();
  if (!week?.challenge_ids.includes(challenge.id)) throw new ChallengeAttemptError("This challenge isn't in your batch this week.", 403);
}

async function closeUsage(service: Service, attemptId: string, outcome: "COMPLETED" | "TIMEOUT" | "FAILED", now: Date): Promise<void> {
  await untyped(service).from("runtime_usage").update({ ended_at: now.toISOString(), outcome }).eq("attempt_id", attemptId).is("ended_at", null);
}

async function streakFor(service: Service, track: "stream" | "domain", userId: string) {
  const table = track === "domain" ? "arena_domain_stats" : "arena_stream_stats";
  const { data } = await service.from(table).select("current_streak, longest_streak, last_completed_week").eq("user_id", userId).maybeSingle();
  const next = advanceStreak({ currentStreak: data?.current_streak ?? 0, longestStreak: data?.longest_streak ?? 0, lastCompletedWeek: data?.last_completed_week ?? null }, currentWeekStart());
  return { current_streak: next.currentStreak, longest_streak: next.longestStreak, last_completed_week: next.lastCompletedWeek };
}

async function complete(service: Service, attemptId: string, result: Record<string, unknown>, track: "stream" | "domain", userId: string) {
  const { data, error } = await untyped(service).rpc("complete_challenge_attempt", { p_attempt_id: attemptId, p_result: result, p_streak: await streakFor(service, track, userId) });
  if (error) throw error;
  return data as { already_completed: boolean; status: AttemptStatus; points_awarded: number; elo_delta: number; evidence_status: string | null };
}

/**
 * A verified Domain pass moves the ONE career ELO ledger, the skill graph and the roadmap (the same path the workstation passes use), so the
 * dashboard, portfolio, passport and leaderboard all see it. Idempotent per attempt; never throws, the attempt result is already saved.
 */
export async function propagateDomainPass(service: Service, userId: string, attempt: AttemptRow, challenge: ChallengeRow): Promise<void> {
  try {
    const { recordArenaPass } = await import("@/lib/assess/arena"); // lazy: it pulls in the service client, which pure-logic tests must not need
    const db = untyped(service);
    const [{ intent }, { data: links }, { data: skills }] = await Promise.all([
      getCareerIntent(service, userId),
      db.from("challenge_careers").select("career_id").eq("challenge_id", challenge.id),
      db.from("arena_challenge_skills").select("skill_id").eq("challenge_id", challenge.id),
    ]);
    const linked = new Set(((links ?? []) as { career_id: string }[]).map((l) => l.career_id));
    const careerId = [intent.primary?.id, intent.secondary?.id].find((id): id is string => Boolean(id) && linked.has(id as string));
    if (!careerId) return;
    const { data: career } = await db.from("careers").select("key").eq("id", careerId).maybeSingle();
    if (!career) return;
    const skillIds = ((skills ?? []) as { skill_id: string }[]).map((s) => s.skill_id);
    await recordArenaPass(userId, { attemptId: attempt.id, roleKey: (career as { key: string }).key, skillId: skillIds[0] ?? null, extraSkillIds: skillIds.slice(1), difficulty: challenge.difficulty as "easy" | "medium" | "hard" }, service as unknown as Db);
  } catch (e) {
    console.error("[arena] domain pass propagation failed:", e);
  }
}

async function expire(service: Service, attempt: AttemptRow, challenge: ChallengeRow, now: Date): Promise<void> {
  await complete(service, attempt.id, { status: "EXPIRED", score: 0, checks_passed: 0, checks_total: 0, check_results: [], time_spent_s: challenge.time_limit_minutes * 60, hints_used: attempt.hints_used, evidence_status: null, grading_version: GRADING_VERSION }, challenge.track, attempt.student_id);
  await closeUsage(service, attempt.id, "TIMEOUT", now);
}

/** Starts a challenge, or resumes the open attempt. Runtime kill switch, daily caps and eligibility are enforced here, not in the UI. */
export async function startChallengeAttempt(service: Service, userId: string, challengeId: string, now: Date = new Date()): Promise<{ attemptId: string; resumed: boolean }> {
  const db = untyped(service);
  const challenge = await loadChallenge(service, challengeId);
  if (!challenge.workstation_template_id) throw new ChallengeAttemptError("This challenge has no workstation configured.", 422);
  const { data: template } = await db.from("workstation_templates").select("runtime_type, is_active").eq("id", challenge.workstation_template_id).maybeSingle();
  if (!template?.is_active) throw new ChallengeAttemptError("This challenge's workstation is not available.", 422);
  const runtimeType = template.runtime_type as RuntimeType;

  await assertEligible(service, userId, challenge);
  const { data: done } = await service.from("arena_challenge_completions").select("id").eq("user_id", userId).eq("challenge_id", challengeId).eq("is_correct", true).maybeSingle();
  if (done) throw new ChallengeAttemptError("You've already passed this challenge.", 409);

  const { data: open } = await db.from("challenge_attempts").select(ATTEMPT_COLUMNS).eq("student_id", userId).eq("challenge_id", challengeId).eq("status", "IN_PROGRESS").maybeSingle();
  if (open) {
    if (!isPastDeadline((open as AttemptRow).expires_at, now)) return { attemptId: (open as AttemptRow).id, resumed: true };
    await expire(service, open as AttemptRow, challenge, now);
  }

  const setting = await loadRuntimeSetting(service, runtimeType);
  const gate = evaluateRuntimeGate(setting, await loadStudentUsageToday(service, userId, runtimeType, now));
  if (!gate.allowed) {
    const [status, message] = GATE_MESSAGE[gate.reason];
    throw new ChallengeAttemptError(message, status, { reason: gate.reason });
  }

  const { data: created, error } = await db
    .from("challenge_attempts")
    .insert({ student_id: userId, challenge_id: challengeId, runtime_type: runtimeType, started_at: now.toISOString(), expires_at: expiresAtFor(now, challenge.time_limit_minutes).toISOString() })
    .select("id")
    .single();
  if (error) {
    // 23505: a second tab started the same challenge first -- resume that one.
    if (error.code !== "23505") throw error;
    const { data: winner } = await db.from("challenge_attempts").select("id").eq("student_id", userId).eq("challenge_id", challengeId).eq("status", "IN_PROGRESS").maybeSingle();
    if (!winner) throw error;
    return { attemptId: winner.id as string, resumed: true };
  }
  await db.from("runtime_usage").insert({ student_id: userId, attempt_id: created.id, runtime_type: runtimeType, started_at: now.toISOString(), cost_cents: setting?.attemptCostCents ?? 0 });
  return { attemptId: created.id as string, resumed: false };
}

/** Everything a workstation needs to render an attempt. Never contains check configs, hidden labels, unrevealed hints, or expected answers. */
export type AttemptView = Awaited<ReturnType<typeof loadAttemptView>>;

export async function loadAttemptView(service: Service, userId: string, attemptId: string) {
  const db = untyped(service);
  const attempt = await loadOwnAttempt(service, userId, attemptId);
  const challenge = await loadChallenge(service, attempt.challenge_id);
  const [{ data: steps }, { data: checks }, { data: hints }, { data: template }, { data: skills }] = await Promise.all([
    db.from("challenge_steps").select("id, step_order, title, instruction").eq("challenge_id", challenge.id).order("step_order"),
    db.from("challenge_checks").select("id, step_id, check_type, label, visible, config").eq("challenge_id", challenge.id),
    db.from("challenge_hints").select("hint_order, body, penalty_points").eq("challenge_id", challenge.id).order("hint_order"),
    db.from("workstation_templates").select("key, runtime_type, config, tools, resource_limits").eq("id", challenge.workstation_template_id).maybeSingle(),
    db.from("arena_challenge_skills").select("skills ( id, name )").eq("challenge_id", challenge.id),
  ]);
  const hintRows = (hints ?? []) as { hint_order: number; body: string; penalty_points: number }[];
  const runtimeType = (template?.runtime_type ?? null) as RuntimeType | null;
  const runtimeSetting = runtimeType ? await loadRuntimeSetting(service, runtimeType) : undefined;
  return {
    attempt: { id: attempt.id, status: attempt.status, startedAt: attempt.started_at, expiresAt: attempt.expires_at, draft: attempt.draft ?? null, result: isFinal(attempt.status) ? resultOf(attempt) : null },
    challenge: { id: challenge.id, track: challenge.track, title: challenge.title, difficulty: challenge.difficulty, estMinutes: challenge.est_minutes ?? challenge.time_limit_minutes, ticketBrief: challenge.ticket_brief },
    steps: steps ?? [],
    // Only `config.public` (prompt, options, units, DOM assertions...) leaves the server; the rest of a check's config holds the expected answers.
    checks: ((checks ?? []) as { id: string; step_id: string | null; check_type: string; label: string; visible: boolean; config: { public?: Record<string, unknown> } | null }[]).map((c) => ({
      id: c.id, stepId: c.step_id, type: c.check_type, visible: c.visible, label: c.visible ? c.label : null, public: c.config?.public ?? null,
    })),
    // starter material the student works with (seed SQL, starter files, notebook cells, datasets). Expected answers never live here.
    assets: challenge.starter_assets_ref,
    // false when an admin switched this workstation off after the attempt began (the student can still read the ticket)
    runtimeEnabled: Boolean(runtimeType && runtimeSetting?.enabled && RUNTIMES[runtimeType].status === "available"),
    aiHelp: { used: attempt.ai_help_uses, max: MAX_AI_HELP, penalty: AI_HELP_PENALTY },
    hints: { total: hintRows.length, used: attempt.hints_used, revealed: hintRows.slice(0, attempt.hints_used).map((h) => ({ order: h.hint_order, body: h.body, penalty: h.penalty_points })) },
    workstation: template ? { key: template.key, runtimeType: template.runtime_type as RuntimeType, config: template.config as Record<string, unknown>, tools: template.tools as string[], limits: template.resource_limits as { memoryMb?: number; wallTimeSeconds?: number } } : null,
    skills: ((skills ?? []) as unknown as { skills: { id: string; name: string } | null }[]).flatMap((s) => (s.skills ? [s.skills] : [])),
  };
}

function resultOf(a: AttemptRow): AttemptResult {
  const total = a.checks_total ?? 0;
  const passedChecks = a.checks_passed ?? 0;
  const verified = a.evidence_status === "VERIFIED_AUTOMATED";
  const message =
    a.status === "EXPIRED" ? "Time ran out before you submitted."
    : a.status === "PASSED" ? (verified ? "Passed — verified by automated checks." : "Passed, but some checks ran only in your browser, so no points, ELO or skill evidence are awarded.")
    : `Not passed yet — ${passedChecks} of ${total} checks passed. You can try again.`;
  return { status: a.status, score: a.score ?? 0, checksPassed: passedChecks, checksTotal: total, results: a.check_results ?? [], evidenceStatus: a.evidence_status, pointsAwarded: a.points_awarded ?? 0, eloDelta: a.elo_delta ?? 0, message };
}

export async function saveDraft(service: Service, userId: string, attemptId: string, draft: unknown, now: Date = new Date()): Promise<void> {
  if (JSON.stringify(draft ?? null).length > MAX_DRAFT_BYTES) throw new ChallengeAttemptError("Your work is too large to save.", 413);
  const attempt = await loadOwnAttempt(service, userId, attemptId);
  if (attempt.status !== "IN_PROGRESS") throw new ChallengeAttemptError("This attempt is already finished.", 409);
  if (isPastDeadline(attempt.expires_at, now)) throw new ChallengeAttemptError("Time is up for this attempt.", 409);
  const { error } = await untyped(service).from("challenge_attempts").update({ draft }).eq("id", attemptId).eq("status", "IN_PROGRESS");
  if (error) throw error;
}

/** Reveals the next hint (in order). Each revealed hint costs score at grading; AI is never involved in grading. */
export async function revealHint(service: Service, userId: string, attemptId: string, now: Date = new Date()) {
  const db = untyped(service);
  const attempt = await loadOwnAttempt(service, userId, attemptId);
  if (attempt.status !== "IN_PROGRESS" || isPastDeadline(attempt.expires_at, now)) throw new ChallengeAttemptError("This attempt is finished.", 409);
  const { data: hints } = await db.from("challenge_hints").select("hint_order, body, penalty_points").eq("challenge_id", attempt.challenge_id).order("hint_order");
  const list = (hints ?? []) as { hint_order: number; body: string; penalty_points: number }[];
  const next = list[attempt.hints_used];
  if (!next) throw new ChallengeAttemptError("There are no more hints.", 409);
  // conditional on the count we read: two quick taps reveal one hint, not two
  const { data: updated } = await db.from("challenge_attempts").update({ hints_used: attempt.hints_used + 1 }).eq("id", attemptId).eq("hints_used", attempt.hints_used).eq("status", "IN_PROGRESS").select("id");
  if (!updated?.length) throw new ChallengeAttemptError("Try again.", 409);
  return { order: next.hint_order, body: next.body, penalty: next.penalty_points, used: attempt.hints_used + 1, total: list.length };
}

/** Grades with deterministic checks and completes the attempt atomically. Idempotent: resubmitting a finished attempt returns its stored result. */
export async function submitChallengeAttempt(
  service: Service,
  userId: string,
  attemptId: string,
  input: { submission: unknown; reflection?: string | null },
  now: Date = new Date(),
  runSql: RunSql = runSqlQueries
): Promise<AttemptResult> {
  const db = untyped(service);
  const attempt = await loadOwnAttempt(service, userId, attemptId);
  if (isFinal(attempt.status)) return resultOf(attempt);

  const submission = SubmissionSchema.safeParse(input.submission ?? {});
  if (!submission.success) throw new ChallengeAttemptError("That submission isn't valid.", 400);

  const challenge = await loadChallenge(service, attempt.challenge_id);
  if (isPastDeadline(attempt.expires_at, now)) {
    await expire(service, attempt, challenge, now);
    return resultOf(await loadOwnAttempt(service, userId, attemptId));
  }

  const [{ data: checkRows }, { data: hints }] = await Promise.all([
    db.from("challenge_checks").select("id, step_id, check_type, label, config, visible, weight, verification").eq("challenge_id", challenge.id),
    db.from("challenge_hints").select("hint_order, penalty_points").eq("challenge_id", challenge.id),
  ]);
  const checks: CheckRow[] = ((checkRows ?? []) as { id: string; step_id: string | null; check_type: CheckRow["checkType"]; label: string; config: Record<string, unknown>; visible: boolean; weight: number; verification: CheckRow["verification"] }[]).map((c) => ({
    id: c.id, stepId: c.step_id, checkType: c.check_type, label: c.label, config: c.config ?? {}, visible: c.visible, weight: c.weight, verification: c.verification,
  }));

  const grade = await gradeAttempt({
    checks,
    submission: submission.data,
    ctx: { assets: challenge.starter_assets_ref, runSql },
    hintPenaltyPoints: hintPenalty((hints ?? []) as { hint_order: number; penalty_points: number }[], attempt.hints_used) + attempt.ai_help_uses * AI_HELP_PENALTY,
    difficulty: challenge.difficulty,
  });

  const done = await complete(
    service,
    attemptId,
    {
      status: grade.passed ? "PASSED" : "FAILED",
      score: grade.score,
      checks_passed: grade.checksPassed,
      checks_total: grade.checksTotal,
      check_results: grade.outcomes.map((o) => ({ checkId: o.checkId, stepId: o.stepId, label: o.label, visible: o.visible, passed: o.passed })),
      time_spent_s: timeSpentSeconds(attempt.started_at, now, challenge.time_limit_minutes),
      hints_used: attempt.hints_used,
      evidence_status: grade.evidenceStatus,
      points: grade.points,
      elo: grade.elo,
      grading_version: GRADING_VERSION,
      submission: submission.data,
      reflection_text: input.reflection?.trim() || null,
    },
    challenge.track,
    userId
  );
  await closeUsage(service, attemptId, "COMPLETED", now);
  if (challenge.track === "domain" && !done.already_completed && done.status === "PASSED" && done.evidence_status === "VERIFIED_AUTOMATED") await propagateDomainPass(service, userId, attempt, challenge);
  return resultOf(await loadOwnAttempt(service, userId, attemptId));
}

export function attemptErrorResponse(error: unknown, scope: string): Response {
  if (error instanceof ChallengeAttemptError) return Response.json({ error: error.message, ...error.extra }, { status: error.status });
  console.error(`[${scope}]`, error);
  return Response.json({ error: "Something went wrong — try again." }, { status: 500 });
}

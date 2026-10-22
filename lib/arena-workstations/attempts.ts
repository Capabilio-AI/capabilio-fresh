import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import { GROQ_MODEL } from "@/lib/ai/groq";
import { advanceStreak } from "@/lib/arena-challenges/streak";
import { currentWeekStart } from "@/lib/arena-challenges/week";
import { COOLDOWN_MS, resolveDailyState, type AssignmentRow } from "./daily";
import { isRegisteredTool, toolFor } from "./registry";
import { commitReservedAttempt, reserveNextArea } from "./rotation-store";
import { getStudentDirection } from "@/lib/career/direction";
import { getEngagedRoleKey, listEnabledRoles, loadRoleTaxonomy, matchRoleForStatedCareer, type SkillAreaRow } from "./taxonomy";
import { resolveDomainRole } from "./role-resolution";
import { staleGradingCutoff } from "./grading-lock";
import { logArenaEvent } from "./log";
import { describeSubmission, MAX_ATTEMPTS } from "./explain-rules";
import { hashSeed } from "@/lib/workplace/rng";
import { loadExperienceLevel } from "@/lib/workplace/level-server";
import { areasForLevel } from "@/lib/workplace/areas";
import { ensureSprint, loadSprintView, stampTicket } from "@/lib/workplace/sprint-server";
import { untyped } from "@/lib/org/db";
import { recordArenaPass } from "@/lib/assess/arena";
import type { Db } from "@/lib/assess/db";
import { GenerationRejected, difficultyForRating, ELO_BY_DIFFICULTY, type GeneratedChallenge, type GradeResult } from "./types";

type Service = SupabaseClient<Database>;

const GENERATION_ATTEMPTS = 3;
const COOLDOWN_HOURS = COOLDOWN_MS / 3_600_000;
const ASSIGNMENT_COLUMNS = "id, challenge_id, assigned_at, completed_at, next_available_at, status, skill_area_key, submission_count, grade, cycle_number, submission";
// Candidate-visible challenge columns — answer_key is never selected for the client.
const PUBLIC_CHALLENGE_COLUMNS = "id, title, category, difficulty, time_limit_minutes, scenario, objective, requester, skill_tags, tool_type, content, skill_area_key";

export class AttemptError extends Error {
  constructor(message: string, readonly status: number, readonly extra: Record<string, unknown> = {}) {
    super(message);
  }
}

export interface AreaProgress {
  key: string;
  name: string;
  toolType: string;
  enabled: boolean;
  disabledReason: string | null;
  verifiedCount: number;
  lastVerifiedAt: string | null;
}

async function resolveRole(service: Service, userId: string, statedRole: string | null) {
  const roles = await listEnabledRoles(service);
  if (roles.length === 0) throw new AttemptError("No domain roles are configured.", 503);
  const [engagedRoleKey, direction] = await Promise.all([getEngagedRoleKey(service, userId), getStudentDirection(service, userId)]);
  const matched = matchRoleForStatedCareer(roles, statedRole);
  // no "first enabled role" fallback: a career without a workstation resolves to null, never to another role's tickets
  const { role } = resolveDomainRole(roles, { activeRoleKey: direction?.activeRoleKey ?? null, engagedRoleKey, statedRole });
  return { role, matched: role !== null && matched?.role_key === role.role_key, engaged: engagedRoleKey !== null };
}

async function explainInfo(service: Service, attempt: { id: string; grade: Json | null; submission: Json | null }, toolType: string) {
  const { data } = await untyped(service).from("arena_task_interviews").select("attempts").eq("attempt_id", attempt.id).maybeSingle();
  const checks = ((attempt.grade as { checks?: { label: string; passed: boolean }[] } | null)?.checks ?? []).filter((c) => c.passed).map((c) => c.label);
  return { submission: describeSubmission(toolType, attempt.submission), checks, attempts: (data as { attempts: number } | null)?.attempts ?? 0, maxAttempts: MAX_ATTEMPTS };
}

async function publicAttempt(service: Service, attempt: AssignmentRow & { status: string; skill_area_key: string | null; submission_count: number; grade: Json | null; submission: Json | null }, areas: SkillAreaRow[]) {
  const { data: challenge, error } = await service.from("arena_challenges").select(PUBLIC_CHALLENGE_COLUMNS).eq("id", attempt.challenge_id).single();
  if (error || !challenge) throw new AttemptError("Challenge instance missing.", 500);
  const area = areas.find((a) => a.area_key === attempt.skill_area_key);
  return {
    attemptId: attempt.id,
    assignedAt: attempt.assigned_at,
    status: attempt.status,
    submissionCount: attempt.submission_count,
    lastGrade: attempt.grade,
    area: { key: attempt.skill_area_key, name: area?.display_name ?? attempt.skill_area_key },
    challenge,
    // a solved task waits for the user to explain it: show what they handed in and how many tries they have used
    explain: attempt.status === "explaining" ? await explainInfo(service, attempt, challenge.tool_type ?? "") : null,
  };
}

/** Read-only: what the Domain tab should show. Never generates. */
export async function getWorkstationState(service: Service, userId: string, statedRole: string | null) {
  const { role, matched, engaged } = await resolveRole(service, userId, statedRole);
  if (!role) {
    logArenaEvent("role.unresolved", { userId, statedRole: statedRole?.slice(0, 80) ?? null });
    return { state: "no_role" as const, statedRole };
  }
  const { areas } = await loadRoleTaxonomy(service, role.role_key);
  const [{ data: attempts }, { data: ratings }, { data: rotation }] = await Promise.all([
    service.from("arena_domain_assignments").select(ASSIGNMENT_COLUMNS).eq("user_id", userId).eq("role_key", role.role_key).order("assigned_at", { ascending: false }),
    service.from("arena_skill_ratings").select("area_key, verified_count, last_verified_at").eq("user_id", userId).eq("role_key", role.role_key),
    service.from("arena_rotation_state").select("cycle_number, served, remaining").eq("user_id", userId).eq("role_key", role.role_key).maybeSingle(),
  ]);

  const progress: AreaProgress[] = areas.map((a) => {
    const r = ratings?.find((x) => x.area_key === a.area_key);
    return { key: a.area_key, name: a.display_name, toolType: a.tool_type, enabled: a.enabled && isRegisteredTool(a.tool_type), disabledReason: a.disabled_reason, verifiedCount: r?.verified_count ?? 0, lastVerifiedAt: r?.last_verified_at ?? null };
  });
  // the week's sprint board; a problem here must never hide the task itself
  const sprint = await loadSprintView(service, userId, role.role_key, Object.fromEntries(areas.map((a) => [a.area_key, a.display_name]))).catch((e) => {
    logArenaEvent("sprint.load_failed", { userId, reason: (e as Error).message.slice(0, 200) });
    return null;
  });
  const base = {
    sprint,
    role: { key: role.role_key, label: role.display_name, parentSkill: role.parent_skill_name },
    statedRole,
    progress,
    cycle: rotation ? { number: rotation.cycle_number, served: rotation.served } : null,
  };

  const rows = (attempts ?? []) as (AssignmentRow & { status: string; skill_area_key: string | null; submission_count: number; grade: Json | null; submission: Json | null })[];
  const daily = resolveDailyState(rows, new Date());
  if (daily.kind === "active") return { ...base, state: "active" as const, attempt: await publicAttempt(service, daily.assignment as (typeof rows)[number], areas) };
  if (daily.kind === "cooldown") return { ...base, state: "cooldown" as const, nextAvailableAt: daily.nextAvailableAt };
  if (!engaged && !matched && rows.length === 0) return { ...base, state: "not_started" as const };
  if (!progress.some((p) => p.enabled)) return { ...base, state: "unavailable" as const };
  return { ...base, state: "ready" as const };
}

async function generateWithRetries(area: SkillAreaRow, ctx: Parameters<ReturnType<typeof toolFor>["generate"]>[0], logFields: Record<string, string>): Promise<GeneratedChallenge> {
  const tool = toolFor(area.tool_type);
  let lastError = "";
  for (let attempt = 1; attempt <= GENERATION_ATTEMPTS; attempt++) {
    const started = Date.now();
    logArenaEvent("generation.started", { ...logFields, attempt });
    try {
      const challenge = await tool.generate(ctx);
      logArenaEvent("generation.completed", { ...logFields, attempt, ms: Date.now() - started });
      return challenge;
    } catch (e) {
      lastError = (e as Error).message;
      logArenaEvent(e instanceof GenerationRejected ? "generation.validation_failed" : "generation.failed", { ...logFields, attempt, ms: Date.now() - started, reason: lastError.slice(0, 200) });
      if (!(e instanceof GenerationRejected) && attempt < GENERATION_ATTEMPTS) await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  throw new AttemptError("We couldn't prepare your next task right now. Nothing was used up — try again in a minute.", 503, { retryable: true, reason: lastError.slice(0, 200) });
}

/**
 * Server-authoritative start: the client never names a skill area. Rotation
 * is only advanced by commit_rotation_attempt, after a validated instance
 * exists — a failed generation leaves it exactly as it was.
 */
export async function startNextAttempt(service: Service, userId: string, statedRole: string | null, focusAreaKey?: string) {
  const state = await getWorkstationState(service, userId, statedRole);
  if (state.state === "no_role") throw new AttemptError("There is no workstation for your target role yet.", 409, { reason: "no_role" });
  if (state.state === "active") return state;
  if (state.state === "cooldown") throw new AttemptError("Your next task unlocks later.", 409, { nextAvailableAt: state.nextAvailableAt });
  if (state.state === "unavailable") throw new AttemptError("No skill areas are enabled for this role yet.", 503);

  const roleKey = state.role.key;
  const { role, areas } = await loadRoleTaxonomy(service, roleKey);
  const enabled = areas.filter((a) => a.enabled && isRegisteredTool(a.tool_type));
  for (const a of enabled) {
    const tool = toolFor(a.tool_type);
    if (tool.generationVersion !== a.generation_version || tool.gradingVersion !== a.grading_version) {
      throw new AttemptError(`Skill area ${a.area_key} is configured for ${a.generation_version}/${a.grading_version} but the code provides ${tool.generationVersion}/${tool.gradingVersion}.`, 500);
    }
  }

  // weakest skill first: the lowest current Arena rating among the role's areas is served next (read fresh, so it follows every completed task)
  const level = await loadExperienceLevel(service, userId);
  const { data: allRatings } = await service.from("arena_skill_ratings").select("area_key, rating").eq("user_id", userId).eq("role_key", roleKey);
  const ratingByArea = Object.fromEntries((allRatings ?? []).map((r) => [r.area_key, r.rating]));
  // areas that need experience are held back until the user has it
  const reservation = await reserveNextArea(service, userId, roleKey, areasForLevel(enabled.map((a) => a.area_key), level), undefined, ratingByArea, focusAreaKey);
  const area = enabled.find((a) => a.area_key === reservation.areaKey)!;
  const tool = toolFor(area.tool_type);

  // untyped: the select reads a key out of the content JSON
  const { data: previousRows, count: ticketCount } = await untyped(service).from("arena_challenges").select("title, tool_type, kind:content->>taskKind", { count: "exact" }).eq("user_id", userId).eq("scope_key", roleKey).order("generated_at", { ascending: false }).limit(20);
  const previous = (previousRows ?? []) as { title: string; tool_type: string | null; kind: string | null }[];
  const recentKinds = previous.filter((p) => p.tool_type === "sql_workspace" && p.kind).slice(0, 2).map((p) => p.kind!);
  const difficulty = difficultyForRating(ratingByArea[area.area_key] ?? 1200);

  const generated = await generateWithRetries(
    area,
    {
      roleName: role.display_name, parentSkill: role.parent_skill_name, areaName: area.display_name, difficulty, avoidTitles: previous.map((p) => p.title),
      // a company world keeps one warehouse per user (worldSeed) and a different ticket each time (ticketSeed)
      roleKey, areaKey: area.area_key, worldSeed: hashSeed(userId, roleKey, "world"), ticketSeed: hashSeed(userId, roleKey, "ticket", ticketCount ?? 0), level, recentKinds,
    },
    { userId, roleKey, area: area.area_key, difficulty }
  );

  const committed = await commitReservedAttempt(service, userId, roleKey, reservation, {
    ...generated,
    difficulty,
    tool_type: area.tool_type,
    generation_provider: generated.origin?.provider ?? "groq",
    generation_model: generated.origin?.model ?? GROQ_MODEL,
    generation_version: tool.generationVersion,
    grading_version: tool.gradingVersion,
  });
  if (committed.conflict) logArenaEvent("rotation.commit_conflict", { userId, roleKey, area: area.area_key });
  else {
    // the ticket joins this week's sprint; if that fails the ticket still works
    try {
      const sprint = await ensureSprint(service, userId, roleKey);
      if (sprint) await stampTicket(service, committed.attemptId, sprint.id);
    } catch (e) {
      logArenaEvent("sprint.stamp_failed", { userId, roleKey, reason: (e as Error).message.slice(0, 200) });
    }
  }

  const after = await getWorkstationState(service, userId, statedRole);
  if (after.state !== "active") throw new AttemptError("Another request changed your rotation — reload to continue.", 409);
  return after;
}

async function loadOwnedOpenAttempt(service: Service, userId: string, attemptId: string) {
  const { data: attempt } = await service.from("arena_domain_assignments").select(`${ASSIGNMENT_COLUMNS}, user_id, role_key`).eq("id", attemptId).eq("user_id", userId).maybeSingle();
  if (!attempt) throw new AttemptError("Task not found.", 404);
  if (attempt.completed_at) throw new AttemptError("This task is already closed.", 409);
  const { data: challenge } = await service.from("arena_challenges").select("id, difficulty, tool_type, content, answer_key, grading_version, user_id").eq("id", attempt.challenge_id).single();
  if (!challenge || challenge.user_id !== userId || !challenge.tool_type) throw new AttemptError("Task not found.", 404);
  return { attempt, challenge };
}

/** SQL exploration against the candidate's own instance only. */
export async function loadOwnedSqlContent(service: Service, userId: string, attemptId: string): Promise<Json> {
  const { challenge } = await loadOwnedOpenAttempt(service, userId, attemptId);
  if (challenge.tool_type !== "sql_workspace" && challenge.tool_type !== "investigation_workspace") throw new AttemptError("This task has no SQL database.", 400);
  return challenge.content as Json;
}

export async function submitAttempt(service: Service, userId: string, attemptId: string, rawSubmission: unknown) {
  const { attempt, challenge } = await loadOwnedOpenAttempt(service, userId, attemptId);
  if (attempt.status === "explaining") throw new AttemptError("This task is already solved. Explain your work to earn your rating.", 409);
  const tool = toolFor(challenge.tool_type!);
  if (challenge.grading_version !== tool.gradingVersion) throw new AttemptError("This task's grader version is not available.", 500);

  const parsed = tool.submissionSchema.safeParse(rawSubmission);
  if (!parsed.success) throw new AttemptError("That submission isn't in the expected format.", 400);

  // Grading lock: only one grading per attempt at a time (double-click / retry safe).
  // The lock time is stamped in submitted_at. If the request that took the lock died (timeout, crash) the ticket would stay "grading" forever, so a
  // lock older than the submit route can run is taken over -- the compare-and-set keeps two takeovers from both winning.
  const lockedAt = new Date().toISOString();
  const lock = () => service.from("arena_domain_assignments").update({ status: "grading", submitted_at: lockedAt }).eq("id", attemptId).is("completed_at", null);
  let { data: locked } = await lock().eq("status", "presented").select("id");
  if (!locked?.length) ({ data: locked } = await lock().eq("status", "grading").lt("submitted_at", staleGradingCutoff(new Date())).select("id"));
  if (!locked?.length) throw new AttemptError("This task is already being graded.", 409);

  const logFields = { userId, attemptId, area: attempt.skill_area_key ?? "", tool: challenge.tool_type! };
  let grade: GradeResult;
  const started = Date.now();
  try {
    logArenaEvent("grading.started", logFields);
    grade = await tool.grade(challenge.content as Json, challenge.answer_key as Json, parsed.data);
    logArenaEvent("grading.completed", { ...logFields, passed: grade.passed, ms: Date.now() - started });
  } catch (e) {
    await service.from("arena_domain_assignments").update({ status: "presented" }).eq("id", attemptId);
    logArenaEvent("grading.failed", { ...logFields, reason: (e as Error).message.slice(0, 200) });
    throw new AttemptError("Grading is temporarily unavailable — your task is still open, try again.", 502);
  }

  const gradeJson = { passed: grade.passed, message: grade.message, checks: grade.checks, detail: grade.detail ?? null, grading_version: tool.gradingVersion } as unknown as Json;
  const submissionJson = parsed.data as unknown as Json;
  const nowIso = new Date().toISOString();

  if (!grade.passed) {
    // a tool may cap the tries (machine learning tasks, where unlimited tries would let someone recover the hidden labels)
    const cap = (challenge.content as { maxSubmissions?: number } | null)?.maxSubmissions;
    const outOfTries = !!cap && attempt.submission_count + 1 >= cap;
    await service
      .from("arena_domain_assignments")
      .update({
        status: outOfTries ? "unexplained" : "presented", grade: gradeJson, submission: submissionJson, submitted_at: nowIso, submission_count: attempt.submission_count + 1,
        ...(outOfTries ? { completed_at: nowIso, next_available_at: new Date(Date.now() + COOLDOWN_MS).toISOString() } : {}),
      })
      .eq("id", attemptId);
    const message = outOfTries ? `${grade.message} You have used all ${cap} tries, so this task is closed without a rating. Your next task is on its way.` : grade.message;
    return { passed: false, message, checks: grade.checks, detail: grade.detail ?? null };
  }

  // Solved. The rating is held back until the user explains their own work (lib/arena-workstations/explain-attempts.ts): the task stays open in "explaining".
  const { error: holdError } = await service
    .from("arena_domain_assignments")
    .update({ status: "explaining", grade: gradeJson, submission: submissionJson, submitted_at: nowIso })
    .eq("id", attemptId)
    .eq("status", "grading")
    .is("completed_at", null);
  if (holdError) {
    await service.from("arena_domain_assignments").update({ status: "presented" }).eq("id", attemptId).is("completed_at", null);
    logArenaEvent("completion.failed", { ...logFields, reason: holdError.message.slice(0, 200) });
    throw new AttemptError("Your answer passed, but saving the result failed — submit again to record it.", 502);
  }
  logArenaEvent("task.solved_awaiting_explanation", { ...logFields, passed: true });
  return { passed: true, explain: true as const, message: "Task solved. Explain your work to earn your rating.", checks: grade.checks, detail: grade.detail ?? null };
}

/**
 * Awards the rating for a solved task whose explanation passed: the atomic completion (rating, evidence, portfolio entry, cooldown) and then the
 * shared role ELO and skill graph. The grade and submission are the ones saved when the task was solved. Throws AttemptError if it cannot save.
 */
export async function finishVerified(service: Service, userId: string, attemptId: string) {
  const { data: attempt } = await service.from("arena_domain_assignments").select("id, user_id, role_key, skill_area_key, challenge_id, status, grade, submission").eq("id", attemptId).eq("user_id", userId).maybeSingle();
  if (!attempt || attempt.status !== "explaining") throw new AttemptError("This task is not waiting for an explanation.", 409);
  const { data: challenge } = await service.from("arena_challenges").select("difficulty").eq("id", attempt.challenge_id).single();
  const difficulty = ((challenge?.difficulty as "easy" | "medium" | "hard" | undefined) ?? "easy");
  const points = ELO_BY_DIFFICULTY[difficulty] ?? ELO_BY_DIFFICULTY.easy;
  try {
    const { data: stats } = await service.from("arena_domain_stats").select("current_streak, longest_streak, last_completed_week").eq("user_id", userId).maybeSingle();
    const streak = advanceStreak({ currentStreak: stats?.current_streak ?? 0, longestStreak: stats?.longest_streak ?? 0, lastCompletedWeek: stats?.last_completed_week ?? null }, currentWeekStart());
    const { data: completion, error } = await service.rpc("complete_workstation_attempt", {
      p_attempt_id: attemptId,
      p_grade: attempt.grade as Json,
      p_submission: attempt.submission as Json,
      p_points: points,
      p_streak: { current_streak: streak.currentStreak, longest_streak: streak.longestStreak, last_completed_week: streak.lastCompletedWeek } as unknown as Json,
      p_cooldown_hours: COOLDOWN_HOURS,
    });
    if (error) throw error;
    const result = completion as { rating_delta: number; points: number; next_available_at: string; evidence_id?: string; already_completed: boolean };
    logArenaEvent("completion.verified", { userId, attemptId, ratingDelta: result.rating_delta, points: result.points, evidenceId: result.evidence_id ?? null, duplicate: result.already_completed });
    // The same pass also moves the student's role ELO (one ledger shared with the career assessment) and their skill graph.
    const arenaSkillId = (await service.from("arena_skill_areas").select("skill_id").eq("role_key", attempt.role_key).eq("area_key", attempt.skill_area_key ?? "").maybeSingle()).data?.skill_id ?? null;
    await recordArenaPass(userId, { attemptId, roleKey: attempt.role_key, skillId: arenaSkillId, difficulty }, service as unknown as Db);
    return { points: result.points, nextAvailableAt: result.next_available_at, evidenceId: result.evidence_id ?? null };
  } catch (e) {
    logArenaEvent("completion.failed", { userId, attemptId, reason: (e as Error).message.slice(0, 200) });
    throw new AttemptError("Your explanation passed, but saving the result failed. Try again to record it.", 502);
  }
}

/** Closes a solved task without a rating (explanation not passed, or skipped). The cooldown still applies. */
export async function closeWithoutRating(service: Service, attemptId: string): Promise<string> {
  const now = new Date();
  const nextAvailableAt = new Date(now.getTime() + COOLDOWN_MS).toISOString();
  const { error } = await service
    .from("arena_domain_assignments")
    .update({ status: "unexplained", completed_at: now.toISOString(), next_available_at: nextAvailableAt })
    .eq("id", attemptId)
    .eq("status", "explaining")
    .is("completed_at", null);
  if (error) throw new AttemptError("Could not close the task. Try again.", 502);
  return nextAvailableAt;
}

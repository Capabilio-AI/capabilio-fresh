import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import { GROQ_MODEL } from "@/lib/ai/groq";
import { advanceStreak } from "@/lib/arena-challenges/streak";
import { currentWeekStart } from "@/lib/arena-challenges/week";
import { COOLDOWN_MS, resolveDailyState, type AssignmentRow } from "./daily";
import { isRegisteredTool, toolFor } from "./registry";
import { commitReservedAttempt, reserveNextArea } from "./rotation-store";
import { getStudentDirection } from "@/lib/career/direction";
import { getEngagedRoleKey, listEnabledRoles, loadRoleTaxonomy, matchRoleForStatedCareer, pickActiveRole, type SkillAreaRow } from "./taxonomy";
import { logArenaEvent } from "./log";
import { GenerationRejected, difficultyForRating, ELO_BY_DIFFICULTY, type GeneratedChallenge, type GradeResult } from "./types";

type Service = SupabaseClient<Database>;

const GENERATION_ATTEMPTS = 3;
const COOLDOWN_HOURS = COOLDOWN_MS / 3_600_000;
const ASSIGNMENT_COLUMNS = "id, challenge_id, assigned_at, completed_at, next_available_at, status, skill_area_key, submission_count, grade, cycle_number";
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
  const role = pickActiveRole(roles, {
    activeRoleKey: direction?.activeRoleKey ?? null,
    engagedRoleKey,
    statedRole,
  })!;
  return { role, matched: matched?.role_key === role.role_key, engaged: engagedRoleKey !== null };
}

async function publicAttempt(service: Service, attempt: AssignmentRow & { status: string; skill_area_key: string | null; submission_count: number; grade: Json | null }, areas: SkillAreaRow[]) {
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
  };
}

/** Read-only: what the Domain tab should show. Never generates. */
export async function getWorkstationState(service: Service, userId: string, statedRole: string | null) {
  const { role, matched, engaged } = await resolveRole(service, userId, statedRole);
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
  const base = {
    role: { key: role.role_key, label: role.display_name, parentSkill: role.parent_skill_name },
    statedRole,
    progress,
    cycle: rotation ? { number: rotation.cycle_number, served: rotation.served } : null,
  };

  const rows = (attempts ?? []) as (AssignmentRow & { status: string; skill_area_key: string | null; submission_count: number; grade: Json | null })[];
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
export async function startNextAttempt(service: Service, userId: string, statedRole: string | null) {
  const state = await getWorkstationState(service, userId, statedRole);
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

  const reservation = await reserveNextArea(service, userId, roleKey, enabled.map((a) => a.area_key));
  const area = enabled.find((a) => a.area_key === reservation.areaKey)!;
  const tool = toolFor(area.tool_type);

  const [{ data: rating }, { data: previous }] = await Promise.all([
    service.from("arena_skill_ratings").select("rating").eq("user_id", userId).eq("role_key", roleKey).eq("area_key", area.area_key).maybeSingle(),
    service.from("arena_challenges").select("title").eq("user_id", userId).eq("scope_key", roleKey).order("generated_at", { ascending: false }).limit(20),
  ]);
  const difficulty = difficultyForRating(rating?.rating ?? 1200);

  const generated = await generateWithRetries(
    area,
    { roleName: role.display_name, parentSkill: role.parent_skill_name, areaName: area.display_name, difficulty, avoidTitles: (previous ?? []).map((p) => p.title) },
    { userId, roleKey, area: area.area_key, difficulty }
  );

  const committed = await commitReservedAttempt(service, userId, roleKey, reservation, {
    ...generated,
    difficulty,
    tool_type: area.tool_type,
    generation_provider: "groq",
    generation_model: GROQ_MODEL,
    generation_version: tool.generationVersion,
    grading_version: tool.gradingVersion,
  });
  if (committed.conflict) logArenaEvent("rotation.commit_conflict", { userId, roleKey, area: area.area_key });

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
  if (challenge.tool_type !== "sql_workspace") throw new AttemptError("This task has no SQL database.", 400);
  return challenge.content as Json;
}

export async function submitAttempt(service: Service, userId: string, attemptId: string, rawSubmission: unknown) {
  const { attempt, challenge } = await loadOwnedOpenAttempt(service, userId, attemptId);
  const tool = toolFor(challenge.tool_type!);
  if (challenge.grading_version !== tool.gradingVersion) throw new AttemptError("This task's grader version is not available.", 500);

  const parsed = tool.submissionSchema.safeParse(rawSubmission);
  if (!parsed.success) throw new AttemptError("That submission isn't in the expected format.", 400);

  // Grading lock: only one grading per attempt at a time (double-click / retry safe).
  const { data: locked } = await service.from("arena_domain_assignments").update({ status: "grading" }).eq("id", attemptId).eq("status", "presented").is("completed_at", null).select("id");
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
    await service
      .from("arena_domain_assignments")
      .update({ status: "presented", grade: gradeJson, submission: submissionJson, submitted_at: nowIso, submission_count: attempt.submission_count + 1 })
      .eq("id", attemptId);
    return { passed: false, message: grade.message, checks: grade.checks, detail: grade.detail ?? null };
  }

  try {
    const points = ELO_BY_DIFFICULTY[challenge.difficulty as "easy" | "medium" | "hard"] ?? ELO_BY_DIFFICULTY.easy;
    const { data: stats } = await service.from("arena_domain_stats").select("current_streak, longest_streak, last_completed_week").eq("user_id", userId).maybeSingle();
    const streak = advanceStreak({ currentStreak: stats?.current_streak ?? 0, longestStreak: stats?.longest_streak ?? 0, lastCompletedWeek: stats?.last_completed_week ?? null }, currentWeekStart());
    const { data: completion, error } = await service.rpc("complete_workstation_attempt", {
      p_attempt_id: attemptId,
      p_grade: gradeJson,
      p_submission: submissionJson,
      p_points: points,
      p_streak: { current_streak: streak.currentStreak, longest_streak: streak.longestStreak, last_completed_week: streak.lastCompletedWeek } as unknown as Json,
      p_cooldown_hours: COOLDOWN_HOURS,
    });
    if (error) throw error;
    const result = completion as { rating_delta: number; points: number; next_available_at: string; evidence_id?: string; already_completed: boolean };
    logArenaEvent("completion.verified", { ...logFields, ratingDelta: result.rating_delta, points: result.points, evidenceId: result.evidence_id ?? null, duplicate: result.already_completed });
    return { passed: true, message: grade.message, checks: grade.checks, detail: grade.detail ?? null, points: result.points, nextAvailableAt: result.next_available_at };
  } catch (e) {
    await service.from("arena_domain_assignments").update({ status: "presented" }).eq("id", attemptId).is("completed_at", null);
    logArenaEvent("completion.failed", { ...logFields, reason: (e as Error).message.slice(0, 200) });
    throw new AttemptError("Your answer passed, but saving the result failed — submit again to record it.", 502);
  }
}

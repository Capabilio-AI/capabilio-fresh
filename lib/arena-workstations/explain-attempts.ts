import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { AttemptError, closeWithoutRating, finishVerified } from "./attempts";
import { decideOutcome, describeSubmission, finalScore, generateExplainQuestions, MAX_ANSWER_CHARS, MAX_ATTEMPTS, QUESTION_COUNT, scoreExplanation, type ExplainScore, type TaskBrief } from "./explain";
import { logArenaEvent } from "./log";
import { finishSessionRated, finishSessionUnrated, sessionBrief, sessionContextFor } from "@/lib/arena-roles/session/finish";

type Service = SupabaseClient<Database>;

interface InterviewRow {
  attempt_id: string;
  attempts: number;
  questions: string[] | null;
  asked: string[];
  score: number | null;
  feedback: ExplainFeedback | null;
}

export interface ExplainFeedback {
  strengths: string[];
  improvements: string[];
  /** a short note per answer, in question order */
  notes: string[];
}

export interface ExplainView {
  /** the task the user solved, so the interview can show it */
  task: { title: string; requester: string | null; scenario: string; objective: string; area: string | null; submission: string; checks: string[] };
  questions: string[];
  attempts: number;
  maxAttempts: number;
  /** the result of the previous try, when this is a second try */
  last: { score: number; feedback: ExplainFeedback } | null;
}

/** The task a user solved and is now explaining. Throws unless it is theirs and waiting for an explanation. */
async function loadExplaining(service: Service, userId: string, attemptId: string) {
  const { data: attempt } = await service.from("arena_domain_assignments").select("id, user_id, status, role_key, skill_area_key, challenge_id, grade, submission").eq("id", attemptId).eq("user_id", userId).maybeSingle();
  if (!attempt) throw new AttemptError("Task not found.", 404);
  if (attempt.status !== "explaining") throw new AttemptError("This task is not waiting for an explanation.", 409);
  const [{ data: challenge }, { data: area }] = await Promise.all([
    service.from("arena_challenges").select("title, requester, scenario, objective, difficulty, tool_type").eq("id", attempt.challenge_id).single(),
    service.from("arena_skill_areas").select("display_name").eq("role_key", attempt.role_key).eq("area_key", attempt.skill_area_key ?? "").maybeSingle(),
  ]);
  if (!challenge) throw new AttemptError("Task not found.", 404);
  const checks = ((attempt.grade as { checks?: { label: string; passed: boolean }[] } | null)?.checks ?? []).filter((c) => c.passed).map((c) => c.label);
  const brief: TaskBrief = {
    title: challenge.title, requester: challenge.requester, scenario: challenge.scenario, objective: challenge.objective, skill: area?.display_name ?? null,
    difficulty: challenge.difficulty, submission: describeSubmission(challenge.tool_type ?? "", attempt.submission), passedChecks: checks,
  };
  // an attempt that closes a Proof Session is explained as the whole session; null for a daily ticket
  const session = await sessionContextFor(service, userId, attemptId);
  if (session) {
    const { data: areas } = await service.from("arena_skill_areas").select("area_key, display_name").eq("role_key", attempt.role_key);
    return { attempt, brief: await sessionBrief(service, userId, session, new Map((areas ?? []).map((a) => [a.area_key, a.display_name]))), areaName: null, session };
  }
  return { attempt, brief, areaName: area?.display_name ?? null, session: null };
}

async function loadInterview(service: Service, attemptId: string): Promise<InterviewRow | null> {
  const { data } = await untyped(service).from("arena_task_interviews").select("attempt_id, attempts, questions, asked, score, feedback").eq("attempt_id", attemptId).maybeSingle();
  return (data as InterviewRow | null) ?? null;
}

const view = (brief: TaskBrief, areaName: string | null, row: InterviewRow, questions: string[]): ExplainView => ({
  task: { title: brief.title, requester: brief.requester, scenario: brief.scenario, objective: brief.objective, area: areaName, submission: brief.submission, checks: brief.passedChecks },
  questions, attempts: row.attempts, maxAttempts: MAX_ATTEMPTS,
  last: row.score !== null && row.feedback ? { score: row.score, feedback: row.feedback } : null,
});

/** Starts (or resumes) the interview: shows the completed task and the questions. Writes a fresh set of questions when there is none. */
export async function startExplanation(service: Service, userId: string, attemptId: string): Promise<ExplainView> {
  const { brief, areaName } = await loadExplaining(service, userId, attemptId);
  let row = await loadInterview(service, attemptId);
  if (!row) {
    await untyped(service).from("arena_task_interviews").upsert({ attempt_id: attemptId, user_id: userId }, { onConflict: "attempt_id", ignoreDuplicates: true });
    row = (await loadInterview(service, attemptId)) ?? { attempt_id: attemptId, attempts: 0, questions: null, asked: [], score: null, feedback: null };
  }
  if (row.questions) return view(brief, areaName, row, row.questions);

  let questions: string[];
  try {
    questions = await generateExplainQuestions(brief, row.asked);
  } catch (e) {
    logArenaEvent("explain.questions_failed", { userId, attemptId, reason: (e as Error).message.slice(0, 200) });
    throw new AttemptError("We could not prepare your interview just now. Nothing was used up, try again in a minute.", 503);
  }
  await untyped(service).from("arena_task_interviews").update({ questions, asked: [...row.asked, ...questions], updated_at: new Date().toISOString() }).eq("attempt_id", attemptId);
  return view(brief, areaName, { ...row, questions }, questions);
}

export type ExplainOutcome =
  | { outcome: "award"; score: number; feedback: ExplainFeedback; points: number; nextAvailableAt: string }
  | { outcome: "retry"; score: number; feedback: ExplainFeedback; triesLeft: number }
  | { outcome: "close"; score: number; feedback: ExplainFeedback; nextAvailableAt: string };

const toFeedback = (s: ExplainScore): ExplainFeedback => ({ strengths: s.strengths, improvements: s.improvements, notes: s.answers.map((a) => a.note) });

/** Scores the answers. A pass runs the normal completion (rating, evidence, portfolio, skill graph); a miss gives another try, then closes the task without a rating. */
export async function submitExplanation(service: Service, userId: string, attemptId: string, answers: unknown): Promise<ExplainOutcome> {
  const given = Array.isArray(answers) ? answers.map((a) => (typeof a === "string" ? a.trim() : "")) : [];
  if (given.length !== QUESTION_COUNT) throw new AttemptError(`Answer all ${QUESTION_COUNT} questions.`, 400);
  if (given.some((a) => a.length > MAX_ANSWER_CHARS)) throw new AttemptError(`Keep each answer under ${MAX_ANSWER_CHARS} characters.`, 400);

  const { brief, session } = await loadExplaining(service, userId, attemptId);
  const row = await loadInterview(service, attemptId);
  if (!row?.questions) throw new AttemptError("Start the interview first.", 409);

  let ai: ExplainScore;
  try {
    ai = await scoreExplanation(brief, row.questions.map((question, i) => ({ question, answer: given[i] })));
  } catch (e) {
    logArenaEvent("explain.scoring_failed", { userId, attemptId, reason: (e as Error).message.slice(0, 200) });
    throw new AttemptError("We could not score your answers just now. Nothing was used up, try again in a minute.", 503);
  }
  const score = finalScore(ai.overallScore, given);
  const attemptsUsed = row.attempts + 1;
  const outcome = decideOutcome(score, attemptsUsed);
  const feedback = toFeedback(ai);

  // only one scoring may win: the update succeeds only if nobody scored this task since we read it
  const { data: saved } = await untyped(service)
    .from("arena_task_interviews")
    .update({ attempts: attemptsUsed, answers: given, score, feedback, passed: outcome === "award", questions: outcome === "retry" ? null : row.questions, updated_at: new Date().toISOString() })
    .eq("attempt_id", attemptId)
    .eq("attempts", row.attempts)
    .select("attempt_id");
  if (!saved?.length) throw new AttemptError("This explanation was already scored. Reload to continue.", 409);

  if (outcome === "retry") return { outcome, score, feedback, triesLeft: MAX_ATTEMPTS - attemptsUsed };
  if (outcome === "close") return { outcome, score, feedback, nextAvailableAt: session ? await finishSessionUnrated(service, userId, session) : await closeWithoutRating(service, attemptId) };

  if (session) {
    const done = await finishSessionRated(service, userId, session);
    for (const id of done.evidenceIds) await recordExplanationOnEvidence(service, id, score);
    return { outcome, score, feedback, points: done.points, nextAvailableAt: done.nextAvailableAt };
  }
  const done = await finishVerified(service, userId, attemptId);
  if (done.evidenceId) await recordExplanationOnEvidence(service, done.evidenceId, score);
  return { outcome, score, feedback, points: done.points, nextAvailableAt: done.nextAvailableAt };
}

/** The user chose not to explain: the task closes with no rating. */
export async function skipExplanation(service: Service, userId: string, attemptId: string): Promise<{ nextAvailableAt: string }> {
  const { session } = await loadExplaining(service, userId, attemptId);
  return { nextAvailableAt: session ? await finishSessionUnrated(service, userId, session) : await closeWithoutRating(service, attemptId) };
}

/** The evidence row says the work was explained and how well, so anyone reading it can see the whole story. */
async function recordExplanationOnEvidence(service: Service, evidenceId: string, score: number): Promise<void> {
  const db = untyped(service);
  const { data } = await db.from("evidence").select("metadata").eq("id", evidenceId).maybeSingle();
  const metadata = { ...((data as { metadata?: Record<string, unknown> } | null)?.metadata ?? {}), explanationScore: score, verification: "deterministic_server_grading+explained" };
  await db.from("evidence").update({ metadata }).eq("id", evidenceId);
}

// Assessment sessions for both layers: start/resume, the prefetch buffer, serving, answering.
//
// Invariants (each has a test or a DB constraint):
//  * the answer key never leaves the server before that question's own submission (PoolPick has no key columns);
//  * a question can only be answered once it was served to this session, and only once (unique response per question);
//  * ELO changes only inside record_assessment_answer, in the same transaction as the response;
//  * the buffer (QUEUED rows) is chosen ahead but never sent to the client, and is rebuilt when adaptation changes direction.

import {
  CAREER_QUESTIONS_DEFAULT, CAREER_QUESTIONS_MAX, CAREER_QUESTIONS_MIN, LIVE_GENERATION_TIMEOUT_MS, PREFETCH_BUFFER, ONBOARDING_STATUSES, QUESTION_SECONDS, ANSWER_GRACE_SECONDS,
  type Difficulty,
} from "./config";
import { getOnboardingStatus, startRating, loadCareer, loadCareerSkills, toTargets, track, type CareerRef, type CareerSkillRow, type Db } from "./db";
import { fitTargets, planNext, type Obs, type Plan, type Target } from "./engine";
import { GENERAL_SECTIONS, commonDifficulty, generalTargets, planFromAvailability } from "./general";
import { topUp } from "./generate";
import type { LlmDeps } from "./generate";
import { careerBankFull, careerSlot, chooseFrom, fetchCandidates, pickFromPool, shuffledOrder, warmPool, type PoolFilter, type PoolPick } from "./pool";
import { AssessError, PoolUnavailableError, type Feedback, type Layer, type QuestionPayload, type SessionStart, type SessionState } from "./types";

/** An assessment may end early (pool ran dry) only after this share of it has been answered. */
const MIN_VIABLE_SHARE = 0.6;

export interface SessionDeps {
  retry?: LlmDeps;
}

export interface SessionRow {
  id: string;
  student_id: string;
  layer: Layer;
  career_id: string | null;
  status: "IN_PROGRESS" | "COMPLETED";
  total_questions: number;
  starting_elo: number | null;
  started_at: string;
  result: unknown;
  section_plan: Record<string, number> | null;
}
const SESSION_COLUMNS = "id, student_id, layer, career_id, status, total_questions, starting_elo, started_at, result, section_plan";

interface RowInfo {
  id: string;
  position: number;
  state: "QUEUED" | "SERVED";
  poolId: string;
  optionOrder: number[];
  targetId: string;
  difficulty: Difficulty;
  answered: boolean;
  correct: boolean | null;
  createdAt: string;
  servedAt: string | null;
  answeredAt: string | null;
  /** question text and options only; the answer key and explanation are never selected here */
  shown: Shown;
}

interface Shown {
  skill_name: string;
  category: string | null;
  question_type: string;
  question_text: string;
  options: string[];
  estimated_seconds: number;
}
const POOL_EMBED = "pool:assess_question_pool(skill_id, section, difficulty, skill_name, category, question_type, question_text, options, estimated_seconds)";

interface Context {
  session: SessionRow;
  career: CareerRef | null;
  skills: CareerSkillRow[];
  targets: Target[];
  rows: RowInfo[];
}

const isUniqueViolation = (e: { code?: string } | null) => e?.code === "23505";
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

export async function loadSession(db: Db, userId: string, sessionId: string): Promise<SessionRow> {
  const { data } = await db.from("assess_sessions").select(SESSION_COLUMNS).eq("id", sessionId).eq("student_id", userId).maybeSingle();
  if (!data) throw new AssessError("SESSION_NOT_FOUND", "Assessment session not found.", 404);
  return data as SessionRow;
}

/** The session's served/queued questions with their answers: only needs the session id, so it can run alongside loading the session. */
async function fetchRows(db: Db, sessionId: string) {
  const { data, error } = await db
    .from("assess_session_questions")
    .select(`id, position, state, pool_question_id, option_order, created_at, served_at, ${POOL_EMBED}, resp:assess_responses(is_correct, answered_at)`)
    .eq("session_id", sessionId)
    .order("position");
  if (error) throw error;
  return (data ?? []) as unknown as RawRow[];
}

async function loadContext(db: Db, session: SessionRow, prefetched?: Promise<RawRow[]>): Promise<Context> {
  const [career, rawRows] = await Promise.all([session.career_id ? loadCareer(db, session.career_id) : null, prefetched ?? fetchRows(db, session.id)]);
  const skills = career ? await loadCareerSkills(db, career.id) : [];
  const targets = fitTargets(career ? toTargets(skills) : generalTargets(session.section_plan), session.total_questions);
  const rows: RowInfo[] = rawRows.map((r) => {
    const pool = one(r.pool)!;
    const resp = one(r.resp);
    return {
      id: r.id, position: r.position, state: r.state, poolId: r.pool_question_id, optionOrder: r.option_order,
      targetId: session.layer === "CAREER" ? pool.skill_id! : pool.section!, difficulty: pool.difficulty,
      answered: resp !== null, correct: resp ? resp.is_correct : null, createdAt: r.created_at, servedAt: r.served_at, answeredAt: resp?.answered_at ?? null,
      shown: { skill_name: pool.skill_name, category: pool.category, question_type: pool.question_type, question_text: pool.question_text, options: pool.options, estimated_seconds: pool.estimated_seconds },
    };
  });
  return { session, career, skills, targets, rows };
}

type PoolCols = Shown & { skill_id: string | null; section: string | null; difficulty: Difficulty };
interface RawRow {
  id: string; position: number; state: "QUEUED" | "SERVED"; pool_question_id: string; option_order: number[]; created_at: string; served_at: string | null;
  pool: PoolCols | PoolCols[] | null;
  resp: { is_correct: boolean; answered_at: string } | { is_correct: boolean; answered_at: string }[] | null;
}

function planOf(taken: readonly RowInfo[], all: readonly RowInfo[]): Plan {
  const answered: Record<string, Obs[]> = {};
  for (const r of all) if (r.answered && r.state === "SERVED") (answered[r.targetId] ??= []).push({ difficulty: r.difficulty, correct: !!r.correct });
  return { taken: taken.map((r) => ({ id: r.targetId, difficulty: r.difficulty })), answered };
}

const filterFor = (ctx: Context, targetId: string): PoolFilter =>
  ctx.session.layer === "CAREER" ? { layer: "CAREER", careerId: ctx.career!.id, skillId: targetId } : { layer: "GENERAL", section: targetId };

// ------------------------------------------------------------------------------------------------------------------
// prefetch buffer
// ------------------------------------------------------------------------------------------------------------------

/**
 * Keeps the next PREFETCH_BUFFER questions chosen. Existing QUEUED rows are kept only while they are still exactly what the
 * adaptive engine would pick for their slot; the first one that no longer fits (the student's level moved, a skill filled
 * up) is invalidated together with everything after it, and the buffer is refilled from the stored Groq pool.
 * Returns the QUEUED rows in serving order (ids included), so callers need no second read.
 */
export async function reconcileBuffer(db: Db, ctx: Context, opts: { allowLive: boolean }, deps: SessionDeps = {}, attempt = 0): Promise<RowInfo[]> {
  const { session, targets } = ctx;
  const sequential = session.layer === "GENERAL";
  const served = ctx.rows.filter((r) => r.state === "SERVED");
  const queued = ctx.rows.filter((r) => r.state === "QUEUED");
  const want = Math.min(PREFETCH_BUFFER, session.total_questions - served.length);
  if (want <= 0) return [];

  const kept: RowInfo[] = [];
  for (const q of queued) {
    const next = planNext(targets, planOf([...served, ...kept], ctx.rows), session.total_questions, { sequential, fixedDifficulty: commonDifficulty });
    if (kept.length < want && next && next.target.id === q.targetId && next.difficulty === q.difficulty) kept.push(q);
    else break;
  }
  const drop = queued.filter((q) => !kept.includes(q));
  if (drop.length > 0) {
    const { error } = await db.from("assess_session_questions").delete().in("id", drop.map((d) => d.id)).eq("state", "QUEUED");
    if (error) throw error;
  }

  const used = new Set(ctx.rows.map((r) => r.poolId));
  drop.forEach((d) => used.delete(d.poolId));
  let live = opts.allowLive && kept.length === 0;

  const fresh: { row: Omit<RowInfo, "id">; pick: PoolPick }[] = [];
  const toRow = (pick: PoolPick, targetId: string, position: number): Omit<RowInfo, "id"> => ({
    position, state: "QUEUED", poolId: pick.id, optionOrder: shuffledOrder(pick.options.length), targetId, difficulty: pick.difficulty,
    answered: false, correct: null, createdAt: new Date().toISOString(), servedAt: null, answeredAt: null,
    shown: { skill_name: pick.skill_name, category: pick.category, question_type: pick.question_type, question_text: pick.question_text, options: pick.options, estimated_seconds: pick.estimated_seconds },
  });

  // Fast fill: plan the empty slots first (pure maths), fetch every candidate in ONE query, and assign in memory. Anything that cannot
  // be satisfied this way falls through to the slower per-slot loop below (which can also generate live).
  if (kept.length < want) {
    const planned: NonNullable<ReturnType<typeof planNext>>[] = [];
    const hypothetical = [...served, ...kept].map((r) => ({ id: r.targetId, difficulty: r.difficulty }));
    for (let i = kept.length; i < want; i++) {
      const next = planNext(targets, { taken: hypothetical, answered: planOf([], ctx.rows).answered }, session.total_questions, { sequential, fixedDifficulty: commonDifficulty });
      if (!next) break;
      planned.push(next);
      hypothetical.push({ id: next.target.id, difficulty: next.difficulty });
    }
    if (planned.length > 0) {
      const rows = await fetchCandidates(db, session.layer, ctx.career?.id ?? null, [...new Set(planned.map((p) => p.target.id))], [...used]);
      const taken = new Set<string>();
      for (const p of planned) {
        const pick = chooseFrom(rows.filter((r) => !taken.has(r.id)), session.layer, p.target.id, p.difficulty, sequential);
        if (!pick) break; // the rest is re-planned by the slow loop with live generation available
        taken.add(pick.id);
        used.add(pick.id);
        fresh.push({ pick, row: toRow(pick, p.target.id, served.length + kept.length + fresh.length + 1) });
      }
    }
  }

  while (kept.length + fresh.length < want) {
    const exclude = new Set<string>();
    let placed = false;
    for (;;) {
      const taken = [...served, ...kept, ...fresh.map((f) => ({ ...f.row, id: "" }))];
      const next = planNext(targets, planOf(taken, ctx.rows), session.total_questions, { sequential, exclude, fixedDifficulty: commonDifficulty });
      if (!next) break;
      let pick = await pickFromPool(db, filterFor(ctx, next.target.id), next.difficulty, [...used], sequential);
      if (!pick && live) {
        live = false; // one blocking attempt per call; it has a timeout and falls through to other skills if it yields nothing
        pick = await liveGenerate(db, ctx, next.target.id, next.difficulty, [...used], deps);
      }
      if (!pick) {
        exclude.add(next.target.id);
        continue;
      }
      used.add(pick.id);
      fresh.push({
        pick,
        row: {
          position: served.length + kept.length + fresh.length + 1, state: "QUEUED", poolId: pick.id, optionOrder: shuffledOrder(pick.options.length),
          targetId: next.target.id, difficulty: pick.difficulty, answered: false, correct: null, createdAt: new Date().toISOString(), servedAt: null, answeredAt: null,
          shown: { skill_name: pick.skill_name, category: pick.category, question_type: pick.question_type, question_text: pick.question_text, options: pick.options, estimated_seconds: pick.estimated_seconds },
        },
      });
      placed = true;
      break;
    }
    if (!placed) break;
  }

  if (fresh.length === 0) return kept;
  // one round trip for the whole refill
  const { data, error } = await db
    .from("assess_session_questions")
    .insert(fresh.map((f) => ({ session_id: session.id, position: f.row.position, pool_question_id: f.pick.id, option_order: f.row.optionOrder, state: "QUEUED" })))
    .select("id, position");
  if (error) {
    if (isUniqueViolation(error) && attempt < 2) return reconcileBuffer(db, await loadContext(db, session), opts, deps, attempt + 1); // raced another reconcile
    throw error;
  }
  const idAt = new Map((data ?? []).map((d: { id: string; position: number }) => [d.position, d.id]));
  return [...kept, ...fresh.map((f) => ({ ...f.row, id: idAt.get(f.row.position)! }))];
}

async function liveGenerate(db: Db, ctx: Context, targetId: string, difficulty: Difficulty, used: string[], deps: SessionDeps): Promise<PoolPick | null> {
  const slot = ctx.session.layer === "CAREER"
    ? (() => { const s = ctx.skills.find((k) => k.skillId === targetId); return s && ctx.career ? careerSlot(ctx.career, s) : null; })()
    : GENERAL_SECTIONS.find((g) => g.section === targetId) ?? null;
  if (!slot) return null;
  // a career with its full bank is served from the database only
  if (ctx.session.layer === "CAREER" && ctx.career && (await careerBankFull(db, ctx.career.id))) return pickFromPool(db, filterFor(ctx, targetId), difficulty, used);
  try {
    await Promise.race([
      topUp(db, slot, difficulty, 2, { rounds: 1, deps: deps.retry }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("live generation timed out")), LIVE_GENERATION_TIMEOUT_MS)),
    ]);
  } catch (e) {
    console.error("[assess] live generation failed, using stored pool:", (e as Error).message);
  }
  return pickFromPool(db, filterFor(ctx, targetId), difficulty, used);
}

/** Background refill after an answer: rebuilds the buffer for the adapted level. Safe to run concurrently (conflicts retry). */
export async function refillBuffer(db: Db, userId: string, sessionId: string, deps: SessionDeps = {}): Promise<void> {
  const rowsP = fetchRows(db, sessionId);
  const session = await loadSession(db, userId, sessionId).catch((e) => { void rowsP.catch(() => {}); throw e; });
  if (session.status !== "IN_PROGRESS") return;
  await reconcileBuffer(db, await loadContext(db, session, rowsP), { allowLive: false }, deps);
}

// ------------------------------------------------------------------------------------------------------------------
// payloads
// ------------------------------------------------------------------------------------------------------------------
function payloadFor(ctx: Context, row: RowInfo): QuestionPayload {
  const q = row.shown;
  return {
    sessionQuestionId: row.id,
    position: row.position,
    total: ctx.session.total_questions,
    layer: ctx.session.layer,
    careerName: ctx.career?.name ?? null,
    skillName: q.skill_name,
    category: q.category,
    difficulty: row.difficulty,
    type: q.question_type,
    text: q.question_text,
    options: row.optionOrder.map((i) => q.options[i]),
    estimatedSeconds: q.estimated_seconds,
    secondsLeft: secondsLeftOf(row.servedAt),
  };
}

function secondsLeftOf(servedAt: string | null): number {
  if (!servedAt) return QUESTION_SECONDS;
  return Math.max(0, Math.min(QUESTION_SECONDS, Math.ceil(QUESTION_SECONDS - (Date.now() - new Date(servedAt).getTime()) / 1000)));
}

/** Feedback for a question that already has a response (resume after refresh shows the locked state). */
async function feedbackFor(db: Db, ctx: Context, row: RowInfo): Promise<Feedback> {
  const [{ data: resp }, { data: pool }] = await Promise.all([
    db.from("assess_responses").select("is_correct, chosen_index, elo_event_id").eq("session_question_id", row.id).single(),
    db.from("assess_question_pool").select("correct_index, explanation").eq("id", row.poolId).single(),
  ]);
  if (!resp || !pool) throw new Error("answered question missing its response");
  const elo = resp.elo_event_id
    ? (await db.from("elo_events").select("previous_rating, change, new_rating").eq("id", resp.elo_event_id).single()).data
    : null;
  const answeredCount = ctx.rows.filter((r) => r.answered).length;
  return {
    isCorrect: resp.is_correct,
    timedOut: resp.chosen_index < 0,
    chosenIndex: resp.chosen_index < 0 ? -1 : row.optionOrder.indexOf(resp.chosen_index),
    correctIndex: row.optionOrder.indexOf(pool.correct_index),
    explanation: pool.explanation,
    alreadyAnswered: true,
    elo: elo ? { previous: elo.previous_rating, change: elo.change, newRating: elo.new_rating } : null,
    answeredCount,
    total: ctx.session.total_questions,
    isLast: answeredCount >= ctx.session.total_questions,
  };
}

// ------------------------------------------------------------------------------------------------------------------
// state / next
// ------------------------------------------------------------------------------------------------------------------
export async function getState(db: Db, userId: string, sessionId: string): Promise<SessionState> {
  const session = await loadSession(db, userId, sessionId);
  return stateOf(db, await loadContext(db, session));
}

async function stateOf(db: Db, ctx: Context): Promise<SessionState> {
  const { session } = ctx;
  const answeredCount = ctx.rows.filter((r) => r.answered).length;
  const latest = [...ctx.rows].reverse().find((r) => r.state === "SERVED") ?? null;
  const base = { sessionId: session.id, layer: session.layer, status: session.status, total: session.total_questions, answeredCount, careerName: ctx.career?.name ?? null };
  const history = ctx.rows.filter((r) => r.answered).map((r) => ({ position: r.position, skillName: r.shown.skill_name, group: session.layer === "CAREER" ? r.shown.skill_name : r.shown.category ?? r.shown.skill_name, difficulty: r.difficulty, correct: !!r.correct }));
  const roleSkills = session.layer === "CAREER" ? ctx.skills.map((s) => ({ name: s.name, importance: s.importance })) : GENERAL_SECTIONS.map((g) => ({ name: g.label, importance: null }));
  const elo = session.layer === "CAREER" && session.career_id
    ? { start: session.starting_elo ?? 400, now: (await db.from("student_career_elo").select("rating").eq("student_id", session.student_id).eq("career_id", session.career_id).maybeSingle()).data?.rating ?? session.starting_elo ?? 400 }
    : null;
  if (session.status === "COMPLETED" || !latest) return { ...base, current: null, canSubmit: false, history, roleSkills, elo };
  return {
    ...base,
    history,
    roleSkills,
    elo,
    current: { question: payloadFor(ctx, latest), feedback: latest.answered ? await feedbackFor(db, ctx, latest) : null },
    canSubmit: session.status === "IN_PROGRESS" && answeredCount >= session.total_questions,
  };
}

/**
 * Serves the next question (idempotent: asking again while one is unanswered returns the same one). Rebuilds the buffer first,
 * so the choice reflects the last answer. If the pool has nothing and Groq cannot help, throws PoolUnavailableError, which the
 * UI shows as a friendly retry; the session and every answer so far are untouched.
 */
export type NextResult = { question: QuestionPayload; ended: false } | { question: null; ended: boolean };

export async function nextQuestion(db: Db, userId: string, sessionId: string, deps: SessionDeps = {}): Promise<NextResult> {
  // Fast path: one database call serves an open question or promotes an up-to-date buffered one.
  const fast = await db.rpc("serve_next_question", { p_student: userId, p_session: sessionId });
  if (fast.error) {
    if (fast.error.message.includes("session_not_found")) throw new AssessError("SESSION_NOT_FOUND", "Assessment session not found.", 404);
    if (fast.error.message.includes("session_closed")) throw new AssessError("SESSION_CLOSED", "This assessment is already finished.", 409);
    throw fast.error;
  }
  const f = fast.data as { status: "OPEN" | "SERVED" | "ENDED" | "NEEDS_PLAN"; layer?: Layer; total?: number; careerName?: string | null;
    row?: { id: string; position: number; optionOrder: number[]; secondsLeft: number };
    question?: { skillName: string; category: string | null; difficulty: Difficulty; type: string; text: string; options: string[]; estimatedSeconds: number } };
  if (f.status === "ENDED") return { question: null, ended: true };
  if (f.status !== "NEEDS_PLAN" && f.row && f.question) {
    return {
      ended: false,
      question: {
        sessionQuestionId: f.row.id, position: f.row.position, total: f.total!, layer: f.layer!, careerName: f.careerName ?? null,
        skillName: f.question.skillName, category: f.question.category, difficulty: f.question.difficulty, type: f.question.type, text: f.question.text,
        options: f.row.optionOrder.map((i) => f.question!.options[i]), estimatedSeconds: f.question.estimatedSeconds, secondsLeft: f.row.secondsLeft,
      },
    };
  }

  const rowsP = fetchRows(db, sessionId); // runs while the session itself loads: one round trip fewer on the hot path
  const session = await loadSession(db, userId, sessionId).catch((e) => { void rowsP.catch(() => {}); throw e; });
  if (session.status !== "IN_PROGRESS") throw new AssessError("SESSION_CLOSED", "This assessment is already finished.", 409);
  const ctx = await loadContext(db, session, rowsP);

  const open = ctx.rows.find((r) => r.state === "SERVED" && !r.answered);
  if (open) return { question: payloadFor(ctx, open), ended: false };
  const answeredNow = ctx.rows.filter((r) => r.answered).length;
  if (answeredNow >= session.total_questions) return { question: null, ended: true };

  // The buffer is rebuilt in the background after every answer. If it was built after the latest answer it is already correct, so
  // serving is a single write; only a buffer that predates the last answer is re-planned here.
  const lastAnswerAt = ctx.rows.reduce((m, r) => (r.answeredAt && r.answeredAt > m ? r.answeredAt : m), "");
  const queued = ctx.rows.filter((r) => r.state === "QUEUED");
  const fresh = queued.length > 0 && queued.every((r) => r.createdAt > lastAnswerAt);
  const queue = fresh ? queued : await reconcileBuffer(db, ctx, { allowLive: true }, deps);
  const first = queue[0];
  if (!first) {
    // Nothing left to ask. Rather than strand a student who has done most of the assessment, end it at what was answered: the results
    // are computed from real answers either way. Below the threshold there is not enough to analyse, so that is an honest retry.
    if (answeredNow >= Math.ceil(session.total_questions * MIN_VIABLE_SHARE)) {
      console.warn(`[assess] question pool ran dry; ending session ${sessionId} at ${answeredNow}/${session.total_questions}`);
      await db.from("assess_sessions").update({ total_questions: answeredNow }).eq("id", sessionId).eq("status", "IN_PROGRESS");
      return { question: null, ended: true };
    }
    throw new PoolUnavailableError();
  }

  const { data: promoted } = await db
    .from("assess_session_questions")
    .update({ state: "SERVED", served_at: new Date().toISOString() })
    .eq("id", first.id)
    .eq("state", "QUEUED")
    .select("id")
    .maybeSingle();
  if (!promoted) return nextQuestion(db, userId, sessionId, deps); // another request promoted it first: return whatever is open now
  // general diagnostic: announce a section the first time one of its questions is served
  if (session.layer === "GENERAL" && !ctx.rows.some((r) => r.state === "SERVED" && r.targetId === first.targetId)) {
    void track(db, userId, "common_section_started", { sessionId, section: first.targetId });
  }
  return { question: payloadFor(ctx, { ...first, servedAt: new Date().toISOString() }), ended: false };
}

// ------------------------------------------------------------------------------------------------------------------
// answer
// ------------------------------------------------------------------------------------------------------------------
export interface AnswerInput {
  sessionQuestionId: string;
  attemptId: string;
  optionIndex: number;
  responseMs?: number | null;
}

const RPC_ERRORS: Record<string, [string, number, string]> = {
  question_not_found: ["QUESTION_NOT_FOUND", 404, "Question not found."],
  question_not_served: ["QUESTION_NOT_SERVED", 409, "This question has not been served to your session."],
  session_closed: ["SESSION_CLOSED", 409, "This assessment is already finished."],
  invalid_option: ["INVALID_OPTION", 400, "That option does not exist."],
};

export async function answerQuestion(db: Db, userId: string, input: AnswerInput): Promise<Feedback & { sessionId: string }> {
  const { data, error } = await db.rpc("record_assessment_answer", {
    p_student: userId, // always the authenticated user, never a client-supplied id
    p_session_question: input.sessionQuestionId,
    p_attempt: input.attemptId,
    p_displayed_index: input.optionIndex,
    p_response_ms: input.responseMs ?? null,
    p_time_limit_s: QUESTION_SECONDS + ANSWER_GRACE_SECONDS,
  });
  if (error) {
    const hit = Object.entries(RPC_ERRORS).find(([k]) => error.message.includes(k));
    if (hit) throw new AssessError(hit[1][0], hit[1][2], hit[1][1]);
    throw error;
  }
  const r = data as {
    alreadyAnswered: boolean; isCorrect: boolean; timedOut: boolean; chosenIndex: number; correctIndex: number; explanation: string;
    elo: { previous: number; change: number; newRating: number } | null;
    sessionId: string; layer: Layer; total: number; answeredCount: number;
  };

  if (!r.alreadyAnswered) {
    const career = r.layer === "CAREER";
    void track(db, userId, career ? "career_question_answered" : "common_question_answered", { sessionId: r.sessionId, correct: r.isCorrect });
    if (career && r.elo) void track(db, userId, "elo_updated", { sessionId: r.sessionId, change: r.elo.change, newRating: r.elo.newRating });
  }
  return {
    sessionId: r.sessionId,
    isCorrect: r.isCorrect, timedOut: r.timedOut, chosenIndex: r.chosenIndex, correctIndex: r.correctIndex, explanation: r.explanation,
    alreadyAnswered: r.alreadyAnswered,
    elo: r.elo ? { previous: r.elo.previous, change: r.elo.change, newRating: r.elo.newRating } : null,
    answeredCount: r.answeredCount, total: r.total, isLast: r.answeredCount >= r.total,
  };
}

// ------------------------------------------------------------------------------------------------------------------
// start / resume
// ------------------------------------------------------------------------------------------------------------------
export function careerSessionLength(skills: readonly CareerSkillRow[]): number {
  const capacity = skills.reduce((a, s) => a + s.max, 0);
  return Math.max(1, Math.min(CAREER_QUESTIONS_DEFAULT, CAREER_QUESTIONS_MAX, capacity));
}
export const careerLengthIsValid = (n: number) => n >= CAREER_QUESTIONS_MIN && n <= CAREER_QUESTIONS_MAX;

/** The student's confirmed primary career. Only this ever drives the career assessment. */
export async function primaryCareerOf(db: Db, userId: string): Promise<string | null> {
  const { data } = await db.from("student_career_intent").select("primary_career_id").eq("student_id", userId).maybeSingle();
  return data?.primary_career_id ?? null;
}

/**
 * The career a session assesses. By default the confirmed primary career. A Plan B assessment passes its own career id; it is
 * accepted only if it is the student's saved Plan B, so a client cannot pick an arbitrary role. Each role keeps its own
 * session, radar and ELO.
 */
async function assessableCareer(db: Db, userId: string, requested: string | null | undefined): Promise<string | null> {
  const { data } = await db.from("student_career_intent").select("primary_career_id, secondary_career_id").eq("student_id", userId).maybeSingle();
  if (!requested) return data?.primary_career_id ?? null;
  if (requested === data?.primary_career_id || requested === data?.secondary_career_id) return requested;
  throw new AssessError("CAREER_NOT_YOURS", "You can only be assessed on your confirmed career or your Plan B.", 403);
}

export async function startSession(db: Db, userId: string, layer: Layer, opts: { careerId?: string | null } = {}, deps: SessionDeps = {}): Promise<SessionStart & { state: SessionState }> {
  const status = await getOnboardingStatus(db, userId);
  let careerId: string | null = null;
  let career: CareerRef | null = null;
  let skills: CareerSkillRow[] = [];

  if (layer === "CAREER") {
    if (ONBOARDING_STATUSES.indexOf(status) < ONBOARDING_STATUSES.indexOf("COMMON_ASSESSMENT_COMPLETE")) {
      throw new AssessError("GENERAL_REQUIRED", "Complete the general assessment first.", 409);
    }
    careerId = await assessableCareer(db, userId, opts.careerId);
    if (!careerId) throw new AssessError("CAREER_REQUIRED", "Confirm your career interest first.", 409);
    career = await loadCareer(db, careerId);
    if (!career) throw new AssessError("CAREER_REQUIRED", "That career is not available. Please choose again.", 409);
    skills = await loadCareerSkills(db, careerId);
    if (skills.length === 0) throw new AssessError("CAREER_UNSUPPORTED", "This career has no assessment yet.", 409);
  }

  const openQuery = () => {
    let q = db.from("assess_sessions").select(SESSION_COLUMNS).eq("student_id", userId).eq("layer", layer).eq("status", "IN_PROGRESS");
    q = careerId ? q.eq("career_id", careerId) : q.is("career_id", null);
    return q.maybeSingle();
  };

  let { data: existing } = await openQuery();
  let resumed = true;
  if (!existing) {
    resumed = false;
    let startingElo: number | null = null;
    // Common assessment: 10 + 10 normally; if the pool is thinner, plan for what exists rather than dead-end the student later.
    let plan: Record<string, number> | null = null;
    if (layer === "GENERAL") {
      const { data: have } = await db.from("assess_question_pool").select("section").eq("layer", "GENERAL").eq("is_active", true).in("section", GENERAL_SECTIONS.map((g) => g.section));
      const available: Record<string, number> = {};
      for (const r of (have ?? []) as { section: string }[]) available[r.section] = (available[r.section] ?? 0) + 1;
      plan = planFromAvailability(available);
      if (Object.values(plan).reduce((a, b) => a + b, 0) < 4) throw new PoolUnavailableError();
      if (generalTargets().some((t) => (plan![t.id] ?? 0) < t.max)) console.warn("[assess] common question pool is thin, planning for:", plan);
      void warmPool(db, { general: true }, deps.retry, 12).catch((e) => console.error("[assess] common warm-up failed:", e));
    }
    if (careerId) {
      const start = await startRating(db);
      await db.from("student_career_elo").upsert({ student_id: userId, career_id: careerId, rating: start }, { onConflict: "student_id,career_id", ignoreDuplicates: true });
      const { data: elo } = await db.from("student_career_elo").select("rating").eq("student_id", userId).eq("career_id", careerId).single();
      startingElo = elo?.rating ?? start;
    }
    const { data: created, error } = await db
      .from("assess_sessions")
      .insert({ student_id: userId, layer, career_id: careerId, total_questions: layer === "CAREER" ? careerSessionLength(skills) : Object.values(plan ?? {}).reduce((a, b) => a + b, 0), starting_elo: startingElo, section_plan: plan })
      .select(SESSION_COLUMNS)
      .single();
    if (error) {
      if (!isUniqueViolation(error)) throw error;
      resumed = true; // a parallel request created it first
      existing = (await openQuery()).data;
    } else {
      existing = created;
      void track(db, userId, layer === "CAREER" ? "career_assessment_started" : "assessment_started", { sessionId: created.id, careerId });
      // top up this role's pool in the background so later questions never wait on Groq
      if (career) void warmPool(db, { career, skills }, deps.retry, 30).catch((e) => console.error("[assess] warmPool failed:", e));
    }
  }
  const session = existing as SessionRow;

  // Prepare (and serve) the first question now, while the student watches the countdown. A resumed session is left exactly as it
  // was, so a refresh on an answered question shows its locked feedback and the Next button instead of skipping ahead.
  let state = await getState(db, userId, session.id);
  if (!state.current && state.status === "IN_PROGRESS") {
    await nextQuestion(db, userId, session.id, deps);
    state = await getState(db, userId, session.id);
  }
  return {
    sessionId: session.id, layer, total: session.total_questions, careerName: career?.name ?? null,
    skills: layer === "CAREER" ? skills.map((s) => s.name) : GENERAL_SECTIONS.map((g) => g.label),
    resumed, startingElo: session.starting_elo, state,
  };
}

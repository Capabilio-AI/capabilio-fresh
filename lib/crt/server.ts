import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { getStudentDirection } from "@/lib/career/direction";
import { appliesTo, attemptExpired, cycleStatus, type CycleStatus } from "./cycle";
import { CRT_MODULES, QUESTIONS_PER_MODULE, type Band, type CrtModule, type CrtOption, type CrtQuestion, type ModuleScores } from "./model";
import { bandFor, scoreAttempt } from "./score";

type Service = SupabaseClient<Database>;

/** Today in India, as YYYY-MM-DD: cycle dates are calendar days at the college, not UTC days. */
export const todayIst = (now: Date = new Date()): string => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);

export interface StudentContext {
  institutionId: string;
  branch: string | null;
  year: number | null;
}

interface CycleRow {
  id: string;
  college_id: string;
  title: string;
  opens_on: string;
  closes_on: string;
  branches: string[] | null;
  years: number[] | null;
  duration_minutes: number;
}

interface AttemptRow {
  id: string;
  cycle_id: string;
  user_id: string;
  college_id: string;
  started_at: string;
  deadline_at: string;
  submitted_at: string | null;
  question_ids: string[];
  answers: Record<string, string>;
  module_scores: ModuleScores | null;
  total_pct: number | null;
}

export interface AttemptResult {
  attemptId: string;
  totalPct: number;
  band: Band;
  moduleScores: ModuleScores;
  submittedAt: string;
}

export interface StudentCycle {
  id: string;
  title: string;
  opensOn: string;
  closesOn: string;
  durationMinutes: number;
  status: CycleStatus;
  /** the student is expected to take it (their branch and year are in scope) */
  applies: boolean;
  result: AttemptResult | null;
  /** an attempt that is started and still has time on the clock */
  inProgress: boolean;
  canStart: boolean;
}

export interface SessionCard {
  id: string;
  module: CrtModule;
  position: number;
  title: string;
  summary: string;
  minutes: number;
  done: boolean;
}

export interface RunnerPayload {
  attemptId: string;
  cycleTitle: string;
  deadlineAt: string;
  questions: { id: string; module: CrtModule; topic: string; prompt: string; options: { key: string; text: string }[] }[];
  answers: Record<string, string>;
}

export type Outcome<T> = ({ ok: true } & T) | { ok: false; status: number; error: string };
const fail = (status: number, error: string): { ok: false; status: number; error: string } => ({ ok: false, status, error });

export async function crtStudentContext(service: Service, userId: string): Promise<StudentContext | null> {
  const { data } = await untyped(service).from("institution_memberships").select("institution_id, branch").eq("user_id", userId).eq("role", "student").eq("status", "active").order("created_at", { ascending: false }).limit(1);
  const m = (data as { institution_id: string; branch: string | null }[] | null)?.[0];
  if (!m) return null;
  const direction = await getStudentDirection(service, userId).catch(() => null);
  return { institutionId: m.institution_id, branch: m.branch, year: direction?.academicYear?.year ?? null };
}

const toResult = (a: AttemptRow): AttemptResult | null =>
  a.submitted_at && a.module_scores && a.total_pct !== null ? { attemptId: a.id, totalPct: Number(a.total_pct), band: bandFor(Number(a.total_pct)), moduleScores: a.module_scores, submittedAt: a.submitted_at } : null;

async function loadQuestions(service: Service, ids: readonly string[]): Promise<(CrtQuestion & { topic: string; prompt: string })[]> {
  if (ids.length === 0) return [];
  const { data, error } = await untyped(service).from("crt_questions").select("id, module, topic, prompt, options").in("id", ids as string[]);
  if (error) throw error;
  const byId = new Map(((data ?? []) as { id: string; module: CrtModule; topic: string; prompt: string; options: CrtOption[] }[]).map((q) => [q.id, q]));
  // keep the order the student was served
  return ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
}

/** Scores and closes an attempt exactly once; returns the stored result (a concurrent submit gets the first one's). */
export async function finalizeAttempt(service: Service, attempt: AttemptRow): Promise<AttemptResult> {
  const existing = toResult(attempt);
  if (existing) return existing;
  const questions = await loadQuestions(service, attempt.question_ids);
  const { moduleScores, totalPct } = scoreAttempt(questions, attempt.answers);
  const submittedAt = new Date().toISOString();
  const { data } = await untyped(service).from("crt_attempts").update({ submitted_at: submittedAt, module_scores: moduleScores, total_pct: totalPct }).eq("id", attempt.id).is("submitted_at", null).select("id").maybeSingle();
  if (!data) {
    const { data: row } = await untyped(service).from("crt_attempts").select("*").eq("id", attempt.id).single();
    const stored = row ? toResult(row as AttemptRow) : null;
    if (stored) return stored;
  }
  return { attemptId: attempt.id, totalPct, band: bandFor(totalPct), moduleScores, submittedAt };
}

async function loadCycles(service: Service, userId: string): Promise<{ ctx: StudentContext; cycles: StudentCycle[] } | null> {
  const ctx = await crtStudentContext(service, userId);
  if (!ctx) return null;
  const db = untyped(service);
  const { data: cycleRows } = await db.from("crt_cycles").select("*").eq("college_id", ctx.institutionId).order("opens_on", { ascending: false }).limit(12);
  const rows = (cycleRows ?? []) as CycleRow[];
  if (rows.length === 0) return { ctx, cycles: [] };
  const { data: attemptRows } = await db.from("crt_attempts").select("*").eq("user_id", userId).in("cycle_id", rows.map((c) => c.id));
  const attempts = new Map(((attemptRows ?? []) as AttemptRow[]).map((a) => [a.cycle_id, a]));

  const now = new Date();
  const today = todayIst(now);
  const cycles: StudentCycle[] = [];
  for (const c of rows) {
    let attempt = attempts.get(c.id) ?? null;
    // a clock that ran out with nothing submitted is scored on what was answered
    if (attempt && !attempt.submitted_at && attemptExpired(attempt.deadline_at, now)) {
      const r = await finalizeAttempt(service, attempt);
      attempt = { ...attempt, submitted_at: r.submittedAt, module_scores: r.moduleScores, total_pct: r.totalPct };
    }
    const status = cycleStatus({ opensOn: c.opens_on, closesOn: c.closes_on }, today);
    const applies = appliesTo({ branches: c.branches, years: c.years }, ctx.branch, ctx.year);
    if (!applies && !attempt) continue;
    const result = attempt ? toResult(attempt) : null;
    cycles.push({
      id: c.id,
      title: c.title,
      opensOn: c.opens_on,
      closesOn: c.closes_on,
      durationMinutes: c.duration_minutes,
      status,
      applies,
      result,
      inProgress: Boolean(attempt && !attempt.submitted_at),
      canStart: applies && status === "open" && !result,
    });
  }
  return { ctx, cycles };
}

export async function loadStudentCrt(service: Service, userId: string): Promise<{ cycles: StudentCycle[]; sessions: SessionCard[] } | null> {
  const base = await loadCycles(service, userId);
  if (!base) return null;
  const db = untyped(service);
  const [{ data: sessionRows }, { data: doneRows }] = await Promise.all([
    db.from("crt_sessions").select("id, module, position, title, summary, minutes").eq("status", "published").order("position", { ascending: true }),
    db.from("crt_session_progress").select("session_id").eq("user_id", userId),
  ]);
  const done = new Set(((doneRows ?? []) as { session_id: string }[]).map((r) => r.session_id));
  const order = new Map(CRT_MODULES.map((m, i) => [m, i]));
  const sessions = ((sessionRows ?? []) as Omit<SessionCard, "done">[])
    .map((s) => ({ ...s, done: done.has(s.id) }))
    .sort((a, b) => (order.get(a.module)! - order.get(b.module)!) || a.position - b.position);
  return { cycles: base.cycles, sessions };
}

export interface CrtDue {
  cycleId: string;
  title: string;
  closesOn: string;
  daysLeft: number;
  inProgress: boolean;
}

/** The one thing the Dashboard card needs: an open cycle the student has not finished. */
export async function loadCrtDue(service: Service, userId: string): Promise<CrtDue | null> {
  const base = await loadCycles(service, userId).catch(() => null);
  const c = base?.cycles.find((x) => x.canStart || (x.inProgress && x.status === "open"));
  if (!c) return null;
  const days = Math.round((Date.parse(`${c.closesOn}T00:00:00Z`) - Date.parse(`${todayIst()}T00:00:00Z`)) / 86_400_000);
  return { cycleId: c.id, title: c.title, closesOn: c.closesOn, daysLeft: Math.max(0, days), inProgress: c.inProgress };
}

const shuffle = <T,>(xs: readonly T[]): T[] => {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

/** Pure. Up to `perModule` ids from each module, preferring ones the student has not seen; module order is kept. */
export function drawQuestionIds(pool: readonly { id: string; module: CrtModule }[], seen: ReadonlySet<string>, perModule: number): string[] {
  return CRT_MODULES.flatMap((m) => {
    const ofModule = shuffle(pool.filter((q) => q.module === m));
    const fresh = ofModule.filter((q) => !seen.has(q.id));
    const used = ofModule.filter((q) => seen.has(q.id));
    return [...fresh, ...used].slice(0, perModule).map((q) => q.id);
  });
}

async function payloadFor(service: Service, attempt: AttemptRow, cycleTitle: string): Promise<RunnerPayload> {
  const questions = await loadQuestions(service, attempt.question_ids);
  return {
    attemptId: attempt.id,
    cycleTitle,
    deadlineAt: attempt.deadline_at,
    questions: questions.map((q) => ({ id: q.id, module: q.module, topic: q.topic, prompt: q.prompt, options: q.options.map(({ key, text }) => ({ key, text })) })),
    answers: attempt.answers,
  };
}

/** Starts the student's one attempt for a cycle, or resumes it while the clock is still running. */
export async function startOrResume(service: Service, userId: string, cycleId: string): Promise<Outcome<{ payload: RunnerPayload }>> {
  const ctx = await crtStudentContext(service, userId);
  if (!ctx) return fail(403, "Only students of a college on Capabilio can take CRT.");
  const db = untyped(service);
  const { data: cycleRow } = await db.from("crt_cycles").select("*").eq("id", cycleId).maybeSingle();
  const cycle = cycleRow as CycleRow | null;
  if (!cycle || cycle.college_id !== ctx.institutionId) return fail(404, "That CRT cycle was not found.");
  if (!appliesTo({ branches: cycle.branches, years: cycle.years }, ctx.branch, ctx.year)) return fail(403, "This cycle is not for your branch or year.");

  const { data: existingRow } = await db.from("crt_attempts").select("*").eq("cycle_id", cycleId).eq("user_id", userId).maybeSingle();
  const existing = existingRow as AttemptRow | null;
  if (existing) {
    if (existing.submitted_at) return fail(409, "You have already completed this assessment.");
    if (attemptExpired(existing.deadline_at, new Date())) {
      await finalizeAttempt(service, existing);
      return fail(409, "Your time for this assessment ended and it was scored on what you had answered.");
    }
    return { ok: true, payload: await payloadFor(service, existing, cycle.title) };
  }

  if (cycleStatus({ opensOn: cycle.opens_on, closesOn: cycle.closes_on }, todayIst()) !== "open") return fail(409, "This assessment is not open right now.");

  const [{ data: pool }, { data: past }] = await Promise.all([
    db.from("crt_questions").select("id, module").eq("status", "published").limit(5000),
    db.from("crt_attempts").select("question_ids").eq("user_id", userId),
  ]);
  const seen = new Set(((past ?? []) as { question_ids: string[] }[]).flatMap((a) => a.question_ids));
  const ids = drawQuestionIds((pool ?? []) as { id: string; module: CrtModule }[], seen, QUESTIONS_PER_MODULE);
  if (ids.length === 0) return fail(503, "The question bank is not ready yet. Please try again later.");

  const deadline = new Date(Date.now() + cycle.duration_minutes * 60_000).toISOString();
  const { data: created, error } = await db.from("crt_attempts").insert({ cycle_id: cycleId, user_id: userId, college_id: ctx.institutionId, branch: ctx.branch, year_of_study: ctx.year, deadline_at: deadline, question_ids: ids }).select("*").single();
  if (error) {
    // two taps at once: the unique (cycle, user) index let the other one in, so resume that
    const { data: again } = await db.from("crt_attempts").select("*").eq("cycle_id", cycleId).eq("user_id", userId).maybeSingle();
    if (again) return { ok: true, payload: await payloadFor(service, again as AttemptRow, cycle.title) };
    throw error;
  }
  return { ok: true, payload: await payloadFor(service, created as AttemptRow, cycle.title) };
}

async function ownAttempt(service: Service, userId: string, attemptId: string): Promise<AttemptRow | null> {
  const { data } = await untyped(service).from("crt_attempts").select("*").eq("id", attemptId).eq("user_id", userId).maybeSingle();
  return (data as AttemptRow | null) ?? null;
}

/** Keeps only answers to questions of this attempt, so nothing else can be written into the row. */
export const cleanAnswers = (questionIds: readonly string[], incoming: Readonly<Record<string, string>>): Record<string, string> => {
  const allowed = new Set(questionIds);
  return Object.fromEntries(Object.entries(incoming).filter(([id, key]) => allowed.has(id) && typeof key === "string" && key.length > 0 && key.length <= 8));
};

export async function saveAnswers(service: Service, userId: string, attemptId: string, incoming: Record<string, string>): Promise<Outcome<{ saved: number }>> {
  const attempt = await ownAttempt(service, userId, attemptId);
  if (!attempt) return fail(404, "Attempt not found.");
  if (attempt.submitted_at) return fail(409, "This assessment is already submitted.");
  if (attemptExpired(attempt.deadline_at, new Date())) return fail(409, "Time is up.");
  const answers = { ...attempt.answers, ...cleanAnswers(attempt.question_ids, incoming) };
  const { error } = await untyped(service).from("crt_attempts").update({ answers }).eq("id", attemptId).is("submitted_at", null);
  if (error) throw error;
  return { ok: true, saved: Object.keys(answers).length };
}

/** Final answers are accepted only inside the time limit; after it the attempt is scored on what was already saved. */
export async function submitAttempt(service: Service, userId: string, attemptId: string, incoming: Record<string, string>): Promise<Outcome<{ result: AttemptResult }>> {
  const attempt = await ownAttempt(service, userId, attemptId);
  if (!attempt) return fail(404, "Attempt not found.");
  if (attempt.submitted_at) return { ok: true, result: (await finalizeAttempt(service, attempt)) };
  const answers = attemptExpired(attempt.deadline_at, new Date()) ? attempt.answers : { ...attempt.answers, ...cleanAnswers(attempt.question_ids, incoming) };
  return { ok: true, result: await finalizeAttempt(service, { ...attempt, answers }) };
}

export async function openSession(service: Service, userId: string, sessionId: string): Promise<Outcome<{ session: { id: string; module: CrtModule; title: string; minutes: number; content: unknown; done: boolean } }>> {
  const db = untyped(service);
  const [{ data }, { data: progress }] = await Promise.all([
    db.from("crt_sessions").select("id, module, title, minutes, content").eq("id", sessionId).eq("status", "published").maybeSingle(),
    db.from("crt_session_progress").select("session_id").eq("user_id", userId).eq("session_id", sessionId).maybeSingle(),
  ]);
  if (!data) return fail(404, "Session not found.");
  return { ok: true, session: { ...(data as { id: string; module: CrtModule; title: string; minutes: number; content: unknown }), done: Boolean(progress) } };
}

export async function completeSession(service: Service, userId: string, sessionId: string): Promise<Outcome<{ done: true }>> {
  const db = untyped(service);
  const { data } = await db.from("crt_sessions").select("id").eq("id", sessionId).eq("status", "published").maybeSingle();
  if (!data) return fail(404, "Session not found.");
  const { error } = await db.from("crt_session_progress").upsert({ user_id: userId, session_id: sessionId }, { onConflict: "user_id,session_id", ignoreDuplicates: true });
  if (error) throw error;
  return { ok: true, done: true };
}

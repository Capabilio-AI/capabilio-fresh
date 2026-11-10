import type { Category } from "./categories";
import type { CrtOption } from "./model";

/** One answered practice question, newest first wherever a list of these is passed. */
export interface LogEntry {
  questionId: string;
  category: Category;
  points: number;
  max: number;
  correct: boolean;
  /** YYYY-MM-DD in India */
  day: string;
}

/** Pure. Share of available points earned, 0-1, or null with nothing answered. */
export function accuracy(entries: readonly Pick<LogEntry, "points" | "max">[]): number | null {
  const max = entries.reduce((s, e) => s + e.max, 0);
  return max > 0 ? entries.reduce((s, e) => s + e.points, 0) / max : null;
}

/** Pure. Difficulty (1 easy - 3 hard) to aim for, from how the last ten answers went. No history starts in the middle. */
export function targetDifficulty(recent: readonly LogEntry[]): 1 | 2 | 3 {
  const acc = accuracy(recent.slice(0, 10));
  if (acc === null) return 2;
  return acc < 0.5 ? 1 : acc < 0.8 ? 2 : 3;
}

export const DIFFICULTY_LABEL = { 1: "Easy", 2: "Medium", 3: "Hard" } as const;

/**
 * Pure. Adaptive practice: up to a third of the set is questions the student last got wrong, the rest prefers questions never seen,
 * and everything leans toward the target difficulty. `entries` are this path's answers, newest first.
 */
export function pickPractice<Q extends { id: string; difficulty: number }>(pool: readonly Q[], entries: readonly LogEntry[], n: number, rand: () => number = Math.random): Q[] {
  const target = targetDifficulty(entries);
  const lastResult = new Map<string, boolean>();
  for (const e of entries) if (!lastResult.has(e.questionId)) lastResult.set(e.questionId, e.correct);
  const cost = (q: Q) => (lastResult.has(q.id) ? 1 : 0) * 10 + Math.abs(q.difficulty - target) + rand() * 0.5;
  const wrong = pool.filter((q) => lastResult.get(q.id) === false).sort((a, b) => cost(a) - cost(b)).slice(0, Math.ceil(n / 3));
  const taken = new Set(wrong.map((q) => q.id));
  const rest = pool.filter((q) => !taken.has(q.id)).sort((a, b) => cost(a) - cost(b)).slice(0, n - wrong.length);
  return [...wrong, ...rest].sort(() => rand() - 0.5);
}

/** Pure. Scores one answer. `correct` means the best available option was chosen. */
export function gradeAnswer(options: readonly CrtOption[], chosenKey: string): { points: number; max: number; bestKey: string; correct: boolean } {
  const best = options.reduce((b, o) => (o.points > b.points ? o : b), options[0]);
  const chosen = options.find((o) => o.key === chosenKey);
  const points = chosen?.points ?? 0;
  return { points, max: Math.max(1, best.points), bestKey: best.key, correct: Boolean(chosen) && points === best.points && best.points > 0 };
}

export interface Competency {
  /** what the student has shown, 0-100, or null when there is not enough evidence yet */
  pct: number | null;
  /** practice answers behind it (latest 20) */
  evidence: number;
  practicePct: number | null;
  assessmentPct: number | null;
}

export const MIN_EVIDENCE = 5;

/**
 * Pure. Demonstrated competency comes only from answered questions and assessment scores. Finishing lessons never moves it: a student who has
 * read every lesson but answered nothing has no evidence, not a high score.
 */
export function competency(entries: readonly LogEntry[], assessmentPct: number | null): Competency {
  const recent = entries.slice(0, 20);
  const acc = recent.length >= MIN_EVIDENCE ? accuracy(recent) : null;
  const practicePct = acc === null ? null : Math.round(acc * 100);
  const parts = [practicePct, assessmentPct === null ? null : Math.round(assessmentPct)].filter((x): x is number => x !== null);
  return { pct: parts.length ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : null, evidence: recent.length, practicePct, assessmentPct: assessmentPct === null ? null : Math.round(assessmentPct) };
}

/** Pure. Consecutive active days ending today (or yesterday, so a streak is not lost before the student has had a chance today). */
export function streak(days: Iterable<string>, today: string): number {
  const set = new Set(days);
  const step = (iso: string, by: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + by * 86_400_000).toISOString().slice(0, 10);
  let cursor = set.has(today) ? today : set.has(step(today, -1)) ? step(today, -1) : null;
  let count = 0;
  while (cursor && set.has(cursor)) {
    count++;
    cursor = step(cursor, -1);
  }
  return count;
}

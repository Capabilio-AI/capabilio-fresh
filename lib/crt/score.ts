import { markFor, totalMarks } from "./marking";
import { CRT_MODULES, type Band, type CrtQuestion, type ModuleScores } from "./model";

/**
 * Pure. Scores a set of answers with negative marking (see marking.ts): a wrong right/wrong answer costs marks, a skipped or unknown answer earns 0, and a
 * module never scores below 0. Every module's maximum is what the served questions could have earned.
 */
export function scoreAttempt(questions: readonly CrtQuestion[], answers: Readonly<Record<string, string>>): { moduleScores: ModuleScores; totalPct: number } {
  const marks = Object.fromEntries(CRT_MODULES.map((m) => [m, [] as number[]])) as Record<(typeof CRT_MODULES)[number], number[]>;
  const max = Object.fromEntries(CRT_MODULES.map((m) => [m, 0])) as Record<(typeof CRT_MODULES)[number], number>;
  for (const q of questions) {
    const best = Math.max(0, ...q.options.map((o) => o.points));
    const chosen = q.options.find((o) => o.key === answers[q.id]);
    marks[q.module].push(markFor(q.module, chosen?.points ?? 0, Boolean(chosen)));
    max[q.module] += best;
  }
  const moduleScores = Object.fromEntries(CRT_MODULES.map((m) => [m, { points: totalMarks(marks[m]), max: max[m] }])) as ModuleScores;
  return { moduleScores, totalPct: totalPct(moduleScores) };
}

export const modulePct = (s: { points: number; max: number }): number => (s.max > 0 ? Math.round((s.points / s.max) * 1000) / 10 : 0);

/** Every module that was part of the attempt counts equally, so a long module cannot drown a short one. */
export function totalPct(scores: ModuleScores): number {
  const used = CRT_MODULES.filter((m) => scores[m].max > 0);
  if (used.length === 0) return 0;
  return Math.round((used.reduce((sum, m) => sum + modulePct(scores[m]), 0) / used.length) * 10) / 10;
}

export function bandFor(pct: number): Band {
  if (pct >= 80) return "strong";
  if (pct >= 60) return "proficient";
  if (pct >= 40) return "developing";
  return "needs_work";
}

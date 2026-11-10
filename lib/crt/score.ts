import { CRT_MODULES, type Band, type CrtQuestion, type ModuleScores } from "./model";

/** Pure. Scores a set of answers; a skipped or unknown answer earns 0. Every module's maximum is what the served questions could have earned. */
export function scoreAttempt(questions: readonly CrtQuestion[], answers: Readonly<Record<string, string>>): { moduleScores: ModuleScores; totalPct: number } {
  const moduleScores = Object.fromEntries(CRT_MODULES.map((m) => [m, { points: 0, max: 0 }])) as ModuleScores;
  for (const q of questions) {
    const best = Math.max(0, ...q.options.map((o) => o.points));
    const chosen = q.options.find((o) => o.key === answers[q.id]);
    moduleScores[q.module] = { points: moduleScores[q.module].points + (chosen?.points ?? 0), max: moduleScores[q.module].max + best };
  }
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

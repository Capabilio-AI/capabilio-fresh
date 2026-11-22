import { pickBySeed } from "./tier-proof";
import { judge0Configured } from "@/lib/code-execution/judge0";
import { isHtmlChallenge, isSqlChallenge, type Track, type TrackModule } from "./types";

/** Share of the assessment that must be right to pass it. */
export const MODULE_PASS_PCT = 70;
/** Questions in one assessment (fewer when the module has fewer). */
export const ASSESSMENT_SIZE = 10;
/** Languages the shared code runner can judge for a module problem. */
export const JUDGED_LANGUAGES: readonly string[] = ["python", "c", "cpp", "java", "javascript"];
/**
 * Languages judged right now. C# joins the list only when the platform runs its own Judge0 with the extra languages switched on (JUDGE0_URL and
 * NEXT_PUBLIC_EXTRA_LANGUAGES=1): the shared public runner has no C#. Until then a C# module is proven by its assessment alone and its page says so.
 */
export const judgedLanguages = (): readonly string[] => (judge0Configured() && process.env.NEXT_PUBLIC_EXTRA_LANGUAGES === "1" ? [...JUDGED_LANGUAGES, "csharp"] : JUDGED_LANGUAGES);

export interface ModuleProofRow {
  assessmentAttempts: number;
  assessmentPassedAt: string | null;
  problemAttempts: number;
  problemPassedAt: string | null;
  provenAt: string | null;
}
export type ModuleStatus = "proven" | "open" | "locked";

/** Pure. Whether this module's problem is part of its proof: it has one, and the judge can run the track's language. */
export const needsProblem = (track: Pick<Track, "runnerLanguage">, m: Pick<TrackModule, "challenge">): boolean => {
  const c = m.challenge;
  if (!c) return false;
  // SQL and page problems are judged by their own checkers, not the code runner, so they count whenever they exist
  return isSqlChallenge(c) || isHtmlChallenge(c) ? true : judgedLanguages().includes(track.runnerLanguage);
};

/** Pure. A module is proven when its assessment is passed and, if it has a problem the judge can run, that is passed too. */
export const isProven = (track: Pick<Track, "runnerLanguage">, m: Pick<TrackModule, "challenge">, row: ModuleProofRow | undefined): boolean =>
  Boolean(row?.assessmentPassedAt) && (!needsProblem(track, m) || Boolean(row?.problemPassedAt));

/** Pure. Proven, open or locked for each module in order: the first is open, and each next one opens only when the one before it is proven. */
export function moduleStatuses(track: Track, rows: Readonly<Record<string, ModuleProofRow>>): ModuleStatus[] {
  let previousProven = true;
  return track.modules.map((m) => {
    const proven = isProven(track, m, rows[m.key]);
    const status: ModuleStatus = proven ? "proven" : previousProven ? "open" : "locked";
    previousProven = proven;
    return status;
  });
}

export interface PoolQuestion { id: string; question: string; options: [string, string, string, string]; answerIndex: number }

/** Pure. Every check question of the module's lessons, each with a stable id of the form `<lesson>:<n>`. */
export function assessmentPool(m: TrackModule): PoolQuestion[] {
  return m.lessons.flatMap((l) => l.lesson.check.map((c, i) => ({ id: `${l.key}:${i}`, question: c.question, options: c.options as [string, string, string, string], answerIndex: c.answerIndex })));
}

/** Pure. The questions of one attempt: the same for the same student and attempt number, different on the next attempt. */
export function pickAssessment(pool: readonly PoolQuestion[], userId: string, moduleKey: string, attempt: number): PoolQuestion[] {
  const ids = pickBySeed(pool.map((q) => q.id), `${userId}:${moduleKey}:${attempt}`, Math.min(ASSESSMENT_SIZE, pool.length));
  const byId = new Map(pool.map((q) => [q.id, q]));
  return ids.map((id) => byId.get(id) as PoolQuestion);
}

/** Pure. What a student may see of a question: never the answer. */
export const publicQuestion = (q: PoolQuestion): { id: string; question: string; options: string[] } => ({ id: q.id, question: q.question, options: [...q.options] });

/** Pure. Marks an attempt against the questions that were asked; an unanswered question is wrong, and an answer for a question that was not asked is ignored. */
export function gradeAssessment(asked: readonly PoolQuestion[], answers: Readonly<Record<string, number>>): { correct: number; total: number; passed: boolean; wrong: string[] } {
  const wrong = asked.filter((q) => answers[q.id] !== q.answerIndex).map((q) => q.id);
  const correct = asked.length - wrong.length;
  return { correct, total: asked.length, passed: asked.length > 0 && (correct / asked.length) * 100 >= MODULE_PASS_PCT, wrong };
}

/** Pure. The lessons of a module the student has not finished: all must be done before the module test opens. */
export const unfinishedLessons = (m: TrackModule, done: Readonly<Record<string, unknown>>): string[] => m.lessons.filter((l) => !done[l.key]).map((l) => l.key);

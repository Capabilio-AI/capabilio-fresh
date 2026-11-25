import { TIERS, type TierNumber } from "./tiers";
import type { Track, TrackModule } from "./types";

/**
 * A language is learned in four levels, one per year of study: Basic, Foundation, Intermediate, Expert. A level is a run of the course's modules; the splits below say
 * how many modules each level takes, in order. Every level must have at least one module, so a short course still has four levels (each thinner) until it grows.
 */
const SPLITS: Readonly<Record<string, readonly [number, number, number, number]>> = {
  c: [4, 6, 5, 4],
  java: [4, 5, 5, 4],
  python: [3, 3, 4, 4],
  cpp: [3, 3, 4, 3],
  sql: [2, 2, 1, 1],
  html: [1, 1, 1, 1],
  javascript: [2, 1, 1, 1],
  csharp: [1, 1, 1, 1],
};

/** The languages whose year exam is a set of Arena problems. SQL and HTML & CSS are not solved as algorithm problems, and C# is not on the shared judge, so their levels are proven by their modules alone. */
const ARENA_EXAM = new Set(["c", "cpp", "java", "python", "javascript"]);

export interface Level { n: TierNumber; key: string; label: string; year: number; modules: TrackModule[] }

/** Pure. The four levels of a track with their modules. A track with no split (or one that does not add up to its modules) puts every module in Basic, never silently drops one. */
export function levelsOf(track: Pick<Track, "key" | "modules">): Level[] {
  const split = SPLITS[track.key];
  const valid = split && split.reduce((a, b) => a + b, 0) === track.modules.length;
  let at = 0;
  return TIERS.map((t, i) => {
    const take = valid ? split[i] : i === 0 ? track.modules.length : 0;
    const modules = track.modules.slice(at, at + take);
    at += take;
    return { n: t.n, key: t.key, label: t.label, year: t.year, modules };
  });
}

/** Pure. The level (1 to 4) a module belongs to. */
export function levelOfModule(track: Pick<Track, "key" | "modules">, moduleKey: string): TierNumber {
  return levelsOf(track).find((l) => l.modules.some((m) => m.key === moduleKey))?.n ?? 1;
}

/** The area under which a language's year exams are recorded. */
export const examArea = (trackKey: string) => `lang-${trackKey}`;
export const hasArenaExam = (trackKey: string): boolean => ARENA_EXAM.has(trackKey);

/**
 * Pure. The levels a student has proven. A level is proven when every one of its modules is proven and, for a language with an Arena exam, the year exam is passed;
 * and only when the level below is proven too, so levels are earned in order.
 */
export function provenLevels(track: Pick<Track, "key" | "modules">, isModuleProven: (m: TrackModule) => boolean, examPassed: readonly number[]): TierNumber[] {
  const out: TierNumber[] = [];
  for (const l of levelsOf(track)) {
    if (l.modules.length === 0 || !l.modules.every(isModuleProven)) break;
    if (hasArenaExam(track.key) && !examPassed.includes(l.n)) break;
    out.push(l.n);
  }
  return out;
}

export type LevelStatus = "proven" | "exam" | "learning" | "locked";
export interface LevelRow extends Level { status: LevelStatus; modulesProven: number }

/** Pure. How each level stands: proven; ready for its exam (every module proven); being learned (the level below is proven); or locked. */
export function levelRows(track: Pick<Track, "key" | "modules">, isModuleProven: (m: TrackModule) => boolean, examPassed: readonly number[]): LevelRow[] {
  const proven = provenLevels(track, isModuleProven, examPassed);
  return levelsOf(track).map((l) => {
    const modulesProven = l.modules.filter(isModuleProven).length;
    const belowProven = l.n === 1 || proven.includes((l.n - 1) as TierNumber);
    const status: LevelStatus = proven.includes(l.n) ? "proven" : !belowProven ? "locked" : hasArenaExam(track.key) && l.modules.length > 0 && modulesProven === l.modules.length ? "exam" : "learning";
    return { ...l, status, modulesProven };
  });
}

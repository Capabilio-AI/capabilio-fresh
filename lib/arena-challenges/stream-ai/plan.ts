import type { Rng } from "@/lib/workplace/rng";
import type { StudentCourse } from "../select-stream";
import type { Difficulty, StreamKind } from "./generate";

const DIFFICULTIES: Difficulty[] = ["hard", "medium", "easy"];

/** Pure. How many unsolved challenges of each difficulty the week still needs, given what the student can already be served. */
export function missingByDifficulty(pool: readonly { id: string; difficulty: string }[], solvedIds: ReadonlySet<string>, mix: Readonly<Record<Difficulty, number>>): Record<Difficulty, number> {
  const have: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 };
  for (const c of pool) if (!solvedIds.has(c.id) && c.difficulty in have) have[c.difficulty as Difficulty]++;
  return { easy: Math.max(0, mix.easy - have.easy), medium: Math.max(0, mix.medium - have.medium), hard: Math.max(0, mix.hard - have.hard) };
}

/** Pure. The difficulties to write, hardest first (so a stopped run still leaves the hard ones), capped at a week's largest batch. */
export const planDifficulties = (missing: Readonly<Record<Difficulty, number>>, cap = 9): Difficulty[] => DIFFICULTIES.flatMap((d) => Array<Difficulty>(Math.max(0, missing[d])).fill(d)).slice(0, cap);

/** Pure. Arena is real-world work only, so every written challenge is a calculation: multiple-choice belongs to the sign-up assessment, never here. */
export const kindFor = (_index: number): StreamKind => "numeric";

/** Pure. For a branch with labs, two of every three slots are hands-on missions and the third is a calculation. Branches without labs are all calculations. */
export const slotKind = (index: number, hasLabs: boolean): StreamKind | "mission" => (!hasLabs || index % 3 === 2 ? "numeric" : "mission");

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Pure. The next subject to write about: the student's current-year courses (else the adjacent years), the one they have had least from first.
 * Null when no curriculum is published, in which case the generator picks a core subject of the branch itself.
 */
export function subjectFor(courses: readonly StudentCourse[], year: number | null, usage: ReadonlyMap<string, number>, rng: Rng): string | null {
  const near = (y: number) => courses.filter((c) => c.year === y);
  const pool = year == null ? courses : near(year).length ? near(year) : [...near(year - 1), ...near(year + 1)].length ? [...near(year - 1), ...near(year + 1)] : courses;
  if (pool.length === 0) return null;
  const used = (c: StudentCourse) => usage.get(norm(c.title)) ?? 0;
  const least = Math.min(...pool.map(used));
  return rng.pick(pool.filter((c) => used(c) === least)).title;
}

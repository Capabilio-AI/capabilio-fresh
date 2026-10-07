export type Difficulty = "easy" | "medium" | "hard";
export type CurriculumTier = "CURRENT_YEAR" | "ADJACENT_YEAR" | "GENERAL";

export const BATCH_SIZE = 8;

export interface StreamCandidate {
  id: string;
  difficulty: string;
  category: string;
  courseTags: string[];
}

export interface StudentCourse {
  title: string;
  year: number;
}

export interface StreamSelectionInput {
  pool: StreamCandidate[];
  solvedIds: ReadonlySet<string>;
  /** challenges served in the last couple of weeks; used only to rank them last, never to exclude */
  recentIds: ReadonlySet<string>;
  /** the student's PUBLISHED curriculum courses; empty when none is published */
  courses: StudentCourse[];
  currentYear: number | null;
  /** Stream points so far (Stream has no ELO) */
  points: number;
  /** same seed -> same batch (user id + week start) */
  seed: string;
}

export interface StreamSelection {
  ids: string[];
  tiers: Record<string, CurriculumTier>;
  /** how many of the BATCH_SIZE could not be filled from real published content */
  shortfall: number;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Deterministic 32-bit FNV-1a, used only as a stable tie-break. */
export function stableHash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** How many easy/medium/hard to aim for, by the student's Stream points. */
export function targetMix(points: number): Record<Difficulty, number> {
  if (points < 100) return { easy: 4, medium: 3, hard: 1 };
  if (points < 300) return { easy: 2, medium: 4, hard: 2 };
  return { easy: 1, medium: 3, hard: 4 };
}

const DIFFICULTY_ORDER: Difficulty[] = ["easy", "medium", "hard"];
const rankOf = (d: string) => Math.max(0, DIFFICULTY_ORDER.indexOf(d as Difficulty));

/** Pure. Which year of the student's curriculum a challenge belongs to, via its course tags matching real course titles. */
export function tierFor(c: StreamCandidate, courses: StudentCourse[], currentYear: number | null): CurriculumTier {
  if (currentYear == null || courses.length === 0 || c.courseTags.length === 0) return "GENERAL";
  const years = new Set<number>();
  for (const tag of c.courseTags.map(norm).filter(Boolean)) {
    for (const course of courses) {
      const title = norm(course.title);
      if (title === tag || (tag.length >= 4 && title.includes(tag))) years.add(course.year);
    }
  }
  if (years.has(currentYear)) return "CURRENT_YEAR";
  if (years.has(currentYear - 1) || years.has(currentYear + 1)) return "ADJACENT_YEAR";
  return "GENERAL";
}

const TIER_RANK: Record<CurriculumTier, number> = { CURRENT_YEAR: 0, ADJACENT_YEAR: 1, GENERAL: 2 };

/**
 * Pure and deterministic. From PUBLISHED, unsolved challenges: prefer the student's current-year subjects, then adjacent years, then
 * general fundamentals; avoid what they were just served; aim for a difficulty mix fitting their points; spread across subjects.
 * Returns fewer than BATCH_SIZE (with `shortfall`) rather than padding.
 */
export function selectStreamBatch(input: StreamSelectionInput): StreamSelection {
  const tiers: Record<string, CurriculumTier> = {};
  const ranked = input.pool
    .filter((c) => !input.solvedIds.has(c.id))
    .map((c) => {
      const tier = tierFor(c, input.courses, input.currentYear);
      tiers[c.id] = tier;
      return { c, bucket: TIER_RANK[tier] * 2 + (input.recentIds.has(c.id) ? 1 : 0), tie: stableHash(`${input.seed}:${c.id}`) };
    })
    .sort((a, b) => a.bucket - b.bucket || a.tie - b.tie);
  const bucketOf = new Map(ranked.map((r) => [r.c.id, r.bucket]));
  const candidates = ranked.map((r) => r.c);

  const picked: StreamCandidate[] = [];
  const perCategory = new Map<string, number>();
  const take = (c: StreamCandidate) => {
    picked.push(c);
    perCategory.set(c.category, (perCategory.get(c.category) ?? 0) + 1);
  };
  // best remaining candidate: the best-ranked bucket (curriculum tier, then not-recently-served) first; within it, the least-used subject
  const next = (from: StreamCandidate[]) => {
    const left = from.filter((c) => !picked.includes(c));
    if (left.length === 0) return undefined;
    const best = Math.min(...left.map((c) => bucketOf.get(c.id)!));
    return left.filter((c) => bucketOf.get(c.id) === best).sort((a, b) => (perCategory.get(a.category) ?? 0) - (perCategory.get(b.category) ?? 0))[0];
  };

  const mix = targetMix(input.points);
  for (const d of DIFFICULTY_ORDER) {
    const ofDifficulty = candidates.filter((c) => c.difficulty === d);
    for (let i = 0; i < mix[d] && picked.length < BATCH_SIZE; i++) {
      const c = next(ofDifficulty);
      if (!c) break;
      take(c);
    }
  }
  // a difficulty ran short: fill from whatever real content remains, nearest to the student's target level first
  const targetRank = mix.hard >= 4 ? 2 : mix.easy >= 4 ? 0 : 1;
  const rest = candidates.filter((c) => !picked.includes(c)).sort((a, b) => Math.abs(rankOf(a.difficulty) - targetRank) - Math.abs(rankOf(b.difficulty) - targetRank));
  while (picked.length < BATCH_SIZE) {
    const c = next(rest);
    if (!c) break;
    take(c);
  }

  picked.sort((a, b) => rankOf(a.difficulty) - rankOf(b.difficulty));
  return { ids: picked.map((c) => c.id), tiers, shortfall: BATCH_SIZE - picked.length };
}

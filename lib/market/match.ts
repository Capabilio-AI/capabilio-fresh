import type { MarketJob } from "./snapshot";

/** A student needs at least this level in a skill for it to count as one they have for a job. */
export const HAVE_LEVEL = 50;

export interface JobMatch { have: number; total: number; percent: number | null; missing: string[] }

/**
 * Pure. How close a student is to one posting: of the skills the posting's text mentions, how many they already show at HAVE_LEVEL or more, and
 * which they do not yet. Null percent when the short posting text named no skill we know (we say nothing rather than guess).
 */
export function matchJob(job: Pick<MarketJob, "skillIds">, levels: ReadonlyMap<string, number | null>, nameOf: ReadonlyMap<string, string>): JobMatch {
  const total = job.skillIds.length;
  const have = job.skillIds.filter((id) => (levels.get(id) ?? 0) >= HAVE_LEVEL).length;
  return {
    have, total,
    percent: total === 0 ? null : Math.round((have / total) * 100),
    missing: job.skillIds.filter((id) => (levels.get(id) ?? 0) < HAVE_LEVEL).map((id) => nameOf.get(id) ?? id),
  };
}

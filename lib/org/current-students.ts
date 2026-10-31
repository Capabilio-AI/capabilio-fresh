import { DEFAULT_ACADEMIC_START_MONTH } from "@/lib/career/academic-year";

/**
 * PostgREST `or` filter for "still studying": no graduation year on file, or the programme has not ended yet. A student whose programme has
 * ended (same rule that moves them to the graduate path, see hasProgrammeEnded) drops out of every college count and list by itself, with
 * nobody pressing anything and no job to run. Their membership stays on record.
 */
export function currentStudentsFilter(now: Date = new Date(), cycleStartMonth: number = DEFAULT_ACADEMIC_START_MONTH): string {
  const year = now.getFullYear();
  const beforeCycleStart = now.getMonth() + 1 < cycleStartMonth;
  return `end_year.is.null,end_year.gt.${year}${beforeCycleStart ? `,end_year.eq.${year}` : ""}`;
}

/** Narrows an institution_memberships query (already limited to role student) to students still in their programme. */
export function onlyCurrentStudents<Q extends { or(filter: string): Q }>(query: Q, now?: Date): Q {
  return query.or(currentStudentsFilter(now));
}

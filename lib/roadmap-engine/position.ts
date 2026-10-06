/** Where a student is in their program, derived deterministically. */

/**
 * The product no longer records a student's semester (only their year), so the semester is an ESTIMATE from the calendar: the first six
 * months after the institution's academic cycle starts are semester 1, the rest semester 2. The roadmap labels it as estimated.
 */
export function estimateSemester(now: Date, cycleStartMonth: number): 1 | 2 {
  const monthsSinceStart = (now.getMonth() + 1 - cycleStartMonth + 12) % 12;
  return monthsSinceStart < 6 ? 1 : 2;
}

/** Program length in years (kept in the shared years utility, where all end-year arithmetic lives). */
export { programLengthYears as totalYearsOf } from "@/lib/career/years";

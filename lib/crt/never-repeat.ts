/**
 * The rule for self-chosen practice and mocks: a question a student has been given is never given to them again. Pure helpers; where the
 * "seen" set comes from is lib/crt/seen.ts.
 */
export function freshOnly<T extends { id: string }>(pool: readonly T[], seen: ReadonlySet<string>): T[] {
  return pool.filter((q) => !seen.has(q.id));
}

/** What the student is told when a test needs more new questions than are left in a section. It never quietly repeats old ones. */
export function exhaustedMessage(section: string, need: number, have: number): string {
  return have === 0
    ? `You have worked through every ${section} question we have. New questions are added regularly: check back soon, or try another section.`
    : `Only ${have} new ${section} question${have === 1 ? "" : "s"} left and this test needs ${need}. Questions you have already answered are never repeated, and new questions are added regularly. Try a shorter test or another section.`;
}

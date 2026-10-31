/**
 * Is this curriculum's analysis complete? Pure. The same questions are asked of every curriculum of every college, so a gap anywhere is found by
 * a machine and not by a student: courses with a syllabus but no skills, courses with nothing read at all, and one course listed twice.
 */
export interface QualityCourse { id: string; title: string; year: number; hasContent: boolean; usableSkills: number }
export interface QualityReport {
  courses: number;
  withContent: number;
  /** have a syllabus and at least one usable skill */
  covered: number;
  /** a syllabus was read but no skill was found: the analysis failed for these, they are retried */
  contentWithoutSkills: string[];
  /** nothing was read from the syllabus (an elective list, or the extractor missed the page) */
  withoutContent: string[];
  duplicates: string[][];
  /** covered / withContent, 0..1 */
  coverage: number;
}

const key = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "");

export function assessCurriculum(courses: readonly QualityCourse[]): QualityReport {
  const withContent = courses.filter((c) => c.hasContent);
  const byTitle = new Map<string, QualityCourse[]>();
  for (const c of courses) byTitle.set(`${c.year}|${key(c.title)}`, [...(byTitle.get(`${c.year}|${key(c.title)}`) ?? []), c]);
  const covered = withContent.filter((c) => c.usableSkills > 0).length;
  return {
    courses: courses.length,
    withContent: withContent.length,
    covered,
    contentWithoutSkills: withContent.filter((c) => c.usableSkills === 0).map((c) => c.title),
    withoutContent: courses.filter((c) => !c.hasContent).map((c) => c.title),
    duplicates: [...byTitle.values()].filter((g) => g.length > 1).map((g) => g.map((c) => c.title)),
    coverage: withContent.length === 0 ? 0 : covered / withContent.length,
  };
}

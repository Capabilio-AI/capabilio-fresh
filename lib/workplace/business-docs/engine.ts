import type { GradeCheck, GradeResult } from "@/lib/arena-workstations/types";
import { gapChecks, issueChecks, processChecks, raciChecks, storyChecks, testChecks } from "./checks";
import type { BusinessDocsContent, BusinessDocsKey, BusinessDocsSubmission, SectionKey } from "./types";

const SECTION_CHECKS: Record<SectionKey, (s: BusinessDocsSubmission, c: BusinessDocsContent, k: BusinessDocsKey) => GradeCheck[]> = {
  stories: storyChecks,
  issues: (s, _c, k) => issueChecks(s, k),
  tests: (s, _c, k) => testChecks(s, k),
  process: processChecks,
  raci: raciChecks,
  gaps: gapChecks,
};

/** Pure. Runs the checks of every section the ticket asks for; passes only when all of them pass. Results are per check, never the expected answer. */
export function gradeBusinessDocs(content: BusinessDocsContent, key: BusinessDocsKey, submission: BusinessDocsSubmission): GradeResult {
  const checks = content.sections.flatMap((s) => SECTION_CHECKS[s](submission, content, key));
  const failing = checks.filter((c) => !c.passed).length;
  return {
    passed: failing === 0,
    message: failing === 0 ? "The document meets every rule." : `${failing} of ${checks.length} rules are not met yet. Look at the ones marked below.`,
    checks,
  };
}

import { assessRoute } from "@/lib/assess/http";
import { latestResult } from "@/lib/assess/finalize";
import { primaryCareerOf } from "@/lib/assess/session";

/** The student's latest finished results: the general profile and the career result for their confirmed career. */
export const GET = assessRoute("assess_result", 60, async (_req, { userId, db }) => {
  const careerId = await primaryCareerOf(db, userId);
  const [general, career] = await Promise.all([latestResult(db, userId, "GENERAL"), careerId ? latestResult(db, userId, "CAREER", careerId) : null]);
  return { general, career };
});

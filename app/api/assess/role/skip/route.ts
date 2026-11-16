import { assessRoute } from "@/lib/assess/http";
import { track } from "@/lib/assess/db";
import { canSkipRole } from "@/lib/assess/skip";
import { saveCareerIntent } from "@/lib/careers/intent";
import { AssessError } from "@/lib/assess/types";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * A 1st or 2nd year chooses not to pick a role yet: they take the common assessment only. It is recorded as "exploring" with no
 * role, which the flow already understands; a role they confirm later (Change role) replaces it. The year is checked here, not in the browser.
 */
export const POST = assessRoute("assess_role_skip", 20, async (_req, { userId, db }) => {
  const service = createServiceClient();
  if (!(await canSkipRole(service, userId))) throw new AssessError("ROLE_REJECTED", "Choosing a role can only be skipped in 1st and 2nd year.", 403);
  const result = await saveCareerIntent(service, userId, { isExploring: true });
  if (!result.ok) throw new AssessError("ROLE_REJECTED", result.message, result.status);
  void track(db, userId, "career_role_skipped", {});
  return { ok: true };
});

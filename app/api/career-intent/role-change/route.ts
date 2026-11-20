import { after } from "next/server";
import { assessRoute, readJson } from "@/lib/assess/http";
import { AssessError } from "@/lib/assess/types";
import { rememberStudentAlias } from "@/lib/assess/roles";
import { warmPrimaryCareerPool } from "@/lib/assess/warm";
import { createServiceClient } from "@/lib/supabase/service";
import { startPathway } from "@/lib/personalization/start";
import { changePrimaryRole, roleChangeState } from "@/lib/careers/role-change";
import { RoleChangeBodySchema } from "@/lib/careers/role-change-rules";

// the new role's roadmap and question pool are prepared after the response, so the function needs the full window
export const maxDuration = 300;

/** How many role changes the signed-in student has left. */
export const GET = assessRoute("role_change_state", 30, async (_req, { userId }) => ({ state: await roleChangeState(createServiceClient(), userId) }));

/**
 * The student's change of main role from the dashboard, with the reason they gave. At most 3 per student; the server enforces it. The new role's
 * roadmap and questions start building at once so the assessment for it does not wait.
 */
export const POST = assessRoute("role_change", 6, async (req, { userId, db }) => {
  const { careerId, reason, details, typed } = await readJson(req, RoleChangeBodySchema);
  const service = createServiceClient();
  const result = await changePrimaryRole(service, userId, { careerId, reason, details });
  if (!result.ok) throw new AssessError("ROLE_CHANGE_REJECTED", result.message, result.status);
  if (typed) await rememberStudentAlias(db, careerId, typed).catch(() => undefined);
  after(() => warmPrimaryCareerPool(userId));
  after(() => startPathway(service, careerId).catch((e) => console.error("[role-change] could not start the pathway:", e)));
  return { ok: true, left: result.left, assessNow: result.assessNow };
});

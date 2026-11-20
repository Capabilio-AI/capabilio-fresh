import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { rememberStudentAlias } from "@/lib/assess/roles";
import { warmPrimaryCareerPool } from "@/lib/assess/warm";
import type { Db } from "@/lib/assess/db";
import { startPathway } from "@/lib/personalization/start";
import { changePrimaryRole, roleChangeState } from "@/lib/careers/role-change";
import { RoleChangeBodySchema } from "@/lib/careers/role-change-rules";
import { parseBody, respond } from "@/lib/careers/route";

// the new role's roadmap and question pool are prepared after the response, so the function needs the full window
export const maxDuration = 300;

/** How many role changes the signed-in student has left. */
export async function GET() {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  return NextResponse.json({ state: await roleChangeState(createServiceClient(), auth.userId) });
}

/**
 * The student's change of main role from the dashboard, with the reason they gave. At most 3 per student; the server enforces it. The student is
 * always the caller; a body cannot name one. The new role's roadmap and questions start building at once so its assessment does not wait.
 */
export async function POST(request: Request) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const limit = await checkRateLimit(auth.userId, { bucket: "role_change", maxRequests: 6, windowSeconds: 60 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);
  const parsed = await parseBody(request, RoleChangeBodySchema);
  if ("error" in parsed) return parsed.error;
  const { careerId, reason, details, typed } = parsed.body;
  const service = createServiceClient();
  const result = await changePrimaryRole(service, auth.userId, { careerId, reason, details });
  if (!result.ok) return respond(result);
  if (typed) await rememberStudentAlias(service as unknown as Db, careerId, typed).catch(() => undefined);
  after(() => warmPrimaryCareerPool(auth.userId));
  after(() => startPathway(service, careerId).catch((e) => console.error("[role-change] could not start the pathway:", e)));
  return respond(result);
}

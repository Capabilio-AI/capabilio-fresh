import { after } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { startRoleSwitch } from "@/lib/careers/role-switch";
import { parseBody, respond } from "@/lib/careers/route";
import { rememberStudentAlias } from "@/lib/assess/roles";
import { warmCareerPool } from "@/lib/assess/warm";
import { startPathway } from "@/lib/personalization/start";

// the new role's roadmap build and question-pool warm-up run after the response
export const maxDuration = 300;

const Body = z.object({ careerId: z.string().uuid(), typed: z.string().max(160).optional() }).strict();

/**
 * The student has reviewed their Plan A profile and confirmed the new role. This only PARKS the new role as a pending switch and starts preparing
 * its roadmap and questions; the main role changes when the new role's assessment is completed (see completeRoleSwitch).
 */
export async function POST(request: Request) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const parsed = await parseBody(request, Body);
  if ("error" in parsed) return parsed.error;
  const service = createServiceClient();
  const result = await startRoleSwitch(service, auth.userId, parsed.body.careerId);
  if (!result.ok) return respond(result);
  // the student confirmed this role for these words, so the registry may now learn them
  if (parsed.body.typed) await rememberStudentAlias(service as never, parsed.body.careerId, parsed.body.typed).catch(() => undefined);
  after(() => warmCareerPool(parsed.body.careerId));
  await startPathway(service, parsed.body.careerId).catch((e) => console.error("[role-switch] could not start the pathway:", e));
  return respond(result);
}

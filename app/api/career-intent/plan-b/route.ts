import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { savePlanB } from "@/lib/careers/intent";
import { PlanBBodySchema } from "@/lib/careers/plan-b-rules";
import { parseBody, respond } from "@/lib/careers/route";

/** The student's one-time Plan B answer (3-1 only). The student is always the caller; a body cannot name one. */
export async function PUT(request: Request) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const parsed = await parseBody(request, PlanBBodySchema);
  if ("error" in parsed) return parsed.error;
  return respond(await savePlanB(createServiceClient(), auth.userId, parsed.body));
}

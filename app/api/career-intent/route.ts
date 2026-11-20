import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { getCareerIntent, saveCareerIntent } from "@/lib/careers/intent";
import { IntentBodySchema } from "@/lib/careers/intent-rules";
import { parseBody, respond } from "@/lib/careers/route";
import { warmPrimaryCareerPool } from "@/lib/assess/warm";
import { roleReplaceBlocked } from "@/lib/careers/role-change";

/** The signed-in student's own career intent, their pending suggestions, and the careers they can choose from. */
export async function GET() {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  return NextResponse.json(await getCareerIntent(createServiceClient(), auth.userId));
}

/** The student's own choice of main career, Plan B and "I'm exploring". The student is always the caller — a body cannot name one. */
export async function PUT(request: Request) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const parsed = await parseBody(request, IntentBodySchema);
  if ("error" in parsed) return parsed.error;
  const service = createServiceClient();
  // Once the dashboard is open, the main role changes only through the dashboard's "Change role" (3 changes, with a reason).
  const blocked = parsed.body.primaryCareerId ? await roleReplaceBlocked(service, auth.userId, parsed.body.primaryCareerId) : null;
  if (blocked) return NextResponse.json({ error: blocked }, { status: 403 });
  const result = await saveCareerIntent(service, auth.userId, parsed.body);
  if (result.ok && parsed.body.primaryCareerId) after(() => warmPrimaryCareerPool(auth.userId));
  return respond(result);
}

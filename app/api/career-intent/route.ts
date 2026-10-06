import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { getCareerIntent, saveCareerIntent } from "@/lib/careers/intent";
import { IntentBodySchema } from "@/lib/careers/intent-rules";
import { parseBody, respond } from "@/lib/careers/route";

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
  return respond(await saveCareerIntent(createServiceClient(), auth.userId, parsed.body));
}

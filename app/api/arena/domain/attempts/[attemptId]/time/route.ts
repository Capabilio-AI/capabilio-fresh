import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { recordWorkTime } from "@/lib/arena-workstations/attempts";

/** The workspace reports in while it is open; the ticket's clock is the server's, kept on the student's account. */
export async function POST(_request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const rateLimit = await checkRateLimit(auth.userId, { bucket: "arena_domain_time", maxRequests: 30, windowSeconds: 60 });
  if (!rateLimit.allowed) return rateLimitedResponse(rateLimit.remaining);

  const { attemptId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(attemptId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const timeSpentSeconds = await recordWorkTime(createServiceClient(), auth.userId, attemptId);
  return NextResponse.json({ timeSpentSeconds });
}

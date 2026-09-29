import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { submitAttempt } from "@/lib/arena-workstations/attempts";
import { attemptErrorResponse } from "@/lib/arena-workstations/http";

export const maxDuration = 60;

/** Ownership comes from the session; the submission is only data for the server-side grader. */
export async function POST(request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const rateLimit = await checkRateLimit(auth.userId, { bucket: "arena_domain_submit", maxRequests: 10, windowSeconds: 60 });
  if (!rateLimit.allowed) return rateLimitedResponse(rateLimit.remaining);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Missing submission." }, { status: 400 });

  const { attemptId } = await params;
  try {
    return NextResponse.json(await submitAttempt(createServiceClient(), auth.userId, attemptId, (body as { submission?: unknown }).submission));
  } catch (error) {
    return attemptErrorResponse(error, "arena/domain/submit");
  }
}

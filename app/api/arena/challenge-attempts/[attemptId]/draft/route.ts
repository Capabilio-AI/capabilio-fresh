import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { attemptErrorResponse, saveDraft } from "@/lib/arena-challenges/attempts";

/** Save work in progress (the only place unfinished work is kept). */
export async function PUT(request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;
  const limit = await checkRateLimit(auth.userId, { bucket: "challenge_attempt_draft", maxRequests: 60, windowSeconds: 60 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);

  const body = (await request.json().catch(() => null)) as { draft?: unknown } | null;
  if (!body || !("draft" in body)) return NextResponse.json({ error: "draft is required." }, { status: 400 });
  try {
    await saveDraft(createServiceClient(), auth.userId, (await params).attemptId, body.draft);
    return NextResponse.json({ saved: true });
  } catch (error) {
    return attemptErrorResponse(error, "arena/challenge-attempts/draft");
  }
}

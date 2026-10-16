import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { skipExplanation, startExplanation, submitExplanation } from "@/lib/arena-workstations/explain-attempts";
import { attemptErrorResponse } from "@/lib/arena-workstations/http";

export const maxDuration = 120;

/**
 * The "explain your work" interview for a task the user has solved. Ownership comes from the session.
 *   { action: "start" }                    the completed task and the questions
 *   { action: "submit", answers: [...] }   score the answers; a pass awards the rating
 *   { action: "skip" }                     close the task with no rating
 */
export async function POST(request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const limited = await checkRateLimit(auth.userId, { bucket: "arena_explain", maxRequests: 20, windowSeconds: 600 });
  if (!limited.allowed) return rateLimitedResponse(limited.remaining);

  const body = (await request.json().catch(() => null)) as { action?: unknown; answers?: unknown } | null;
  const { attemptId } = await params;
  const service = createServiceClient();
  try {
    if (body?.action === "start") return NextResponse.json(await startExplanation(service, auth.userId, attemptId));
    if (body?.action === "submit") return NextResponse.json(await submitExplanation(service, auth.userId, attemptId, body.answers));
    if (body?.action === "skip") return NextResponse.json(await skipExplanation(service, auth.userId, attemptId));
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    return attemptErrorResponse(error, "arena/domain/explain");
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { loadOwnedSqlContent } from "@/lib/arena-workstations/attempts";
import { runExploratoryQuery } from "@/lib/arena-workstations/tools/sql";
import { attemptErrorResponse } from "@/lib/arena-workstations/http";
import { recordQueryForAttempt } from "@/lib/arena-roles/session/record";

const BodySchema = z.object({ query: z.string().trim().min(1).max(5000), explore: z.boolean().optional() });

/** Exploration only: runs the candidate's SQL on their own task's data. Never graded. */
export async function POST(request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const rateLimit = await checkRateLimit(auth.userId, { bucket: "arena_domain_run", maxRequests: 30, windowSeconds: 60 });
  if (!rateLimit.allowed) return rateLimitedResponse(rateLimit.remaining);

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Write a query first." }, { status: 400 });

  const { attemptId } = await params;
  try {
    const service = createServiceClient();
    const content = await loadOwnedSqlContent(service, auth.userId, attemptId);
    const result = await runExploratoryQuery(content, parsed.data.query, parsed.data.explore);
    // a stage of a Proof Session keeps a trusted record of the queries run (nothing happens for an ordinary ticket)
    await recordQueryForAttempt(service, auth.userId, attemptId, parsed.data.query, !("error" in result));
    return NextResponse.json(result);
  } catch (error) {
    return attemptErrorResponse(error, "arena/domain/run");
  }
}

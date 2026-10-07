import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { NodeStateError, SemesterBody, confirmSemester } from "@/lib/roadmap-visual/node-state";

/** The student confirms their current semester; until then the roadmap shows an estimate and says so. */
export async function PUT(request: Request) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const limit = await checkRateLimit(auth.userId, { bucket: "roadmap_semester", maxRequests: 20, windowSeconds: 600 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);
  const body = SemesterBody.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "semester must be 1 or 2." }, { status: 400 });
  try {
    await confirmSemester(createServiceClient(), auth.userId, body.data.semester);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof NodeStateError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[roadmap/semester]", error);
    return NextResponse.json({ error: "Could not save. Try again." }, { status: 500 });
  }
}

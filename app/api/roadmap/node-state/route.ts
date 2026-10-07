import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { NodeStateBody, NodeStateError, setNodeState } from "@/lib/roadmap-visual/node-state";

/** Mark a topic Learning, Done or Skipped (a skip needs a reason), or clear the mark. Only the caller's own state. */
export async function PUT(request: Request) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const limit = await checkRateLimit(auth.userId, { bucket: "roadmap_node_state", maxRequests: 120, windowSeconds: 600 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);
  const body = NodeStateBody.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: body.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  try {
    await setNodeState(createServiceClient(), auth.userId, body.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof NodeStateError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[roadmap/node-state]", error);
    return NextResponse.json({ error: "Could not save. Try again." }, { status: 500 });
  }
}

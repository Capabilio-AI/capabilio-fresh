import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { getRoadmapGraph } from "@/lib/roadmap-visual/service";

/** The caller's visual roadmap (primary career, or `?career=plan-b`): the published tree overlaid with their evidence, node state and syllabus. */
export async function GET(request: Request) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const limit = await checkRateLimit(auth.userId, { bucket: "roadmap_graph", maxRequests: 120, windowSeconds: 600 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);
  const which = new URL(request.url).searchParams.get("career") === "plan-b" ? "plan-b" : "primary";
  try {
    return NextResponse.json(await getRoadmapGraph(createServiceClient(), auth.userId, which), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[roadmap/graph]", error);
    return NextResponse.json({ error: "Could not load your roadmap. Try again." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { loggedCompleteJson } from "@/lib/ai/log";
import { loadGraphContext } from "@/lib/roadmap-visual/context";
import { GUIDE_SYSTEM, GuideBody, ProjectGuide, buildGuidePrompt, findResource } from "@/lib/roadmap-visual/project-guide";

export const maxDuration = 60;

// ponytail: per-instance memory cache (a guide depends only on the project); move to a table if cold starts make it miss often.
const cache = new Map<string, ProjectGuide>();

/** Step-by-step guide for one catalogue project, written by AI from the stored description. Never changes a score. */
export async function POST(request: Request) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const limit = await checkRateLimit(auth.userId, { bucket: "roadmap_project_guide", maxRequests: 20, windowSeconds: 600 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);
  const body = GuideBody.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const service = createServiceClient();
  try {
    const hit = cache.get(body.data.resourceId);
    if (hit) return NextResponse.json({ guide: hit }, { headers: { "Cache-Control": "no-store" } });
    const loaded = await loadGraphContext(service, auth.userId, body.data.career);
    const resource = loaded.ok ? findResource(loaded.ctx.resources, body.data.resourceId) : null;
    if (!loaded.ok || !resource || resource.kind !== "PROJECT") return NextResponse.json({ error: "That project isn't available." }, { status: 404 });
    const guide = await loggedCompleteJson(service, { feature: "roadmap_project_guide", userId: auth.userId, meta: { resource: resource.id } }, buildGuidePrompt(resource, loaded.ctx.career.name), GUIDE_SYSTEM, ProjectGuide);
    cache.set(resource.id, guide);
    return NextResponse.json({ guide }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[roadmap/project-guide]", error);
    return NextResponse.json({ error: "Couldn't write the guide just now. Try again in a moment." }, { status: 502 });
  }
}

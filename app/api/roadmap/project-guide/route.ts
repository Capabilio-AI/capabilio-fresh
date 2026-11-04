import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { loggedCompleteJson } from "@/lib/ai/log";
import { loadGraphContext } from "@/lib/roadmap-visual/context";
import { DATA_SYSTEM, GUIDE_SYSTEM, GuideBody, ProjectData, ProjectGuide, buildDataPrompt, buildGuidePrompt, findResource, type ProjectGuideView } from "@/lib/roadmap-visual/project-guide";
import { loadStoredGuide, saveGuide } from "@/lib/roadmap-visual/guide-store";

export const maxDuration = 60;

const NO_DATA: ProjectData = { datasets: [], realDataIdeas: [] };

/**
 * The guide and practice data for one catalogue project. Written once by AI from the stored description and then kept, so the next student gets
 * it instantly. The guide and the data are separate AI calls: if the data cannot be written, the student still gets the guide (and the data is
 * tried again next time). Never changes a score.
 */
export async function POST(request: Request) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const limit = await checkRateLimit(auth.userId, { bucket: "roadmap_project_guide", maxRequests: 20, windowSeconds: 600 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);
  const body = GuideBody.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const service = createServiceClient();
  const reply = (guide: ProjectGuideView) => NextResponse.json({ guide }, { headers: { "Cache-Control": "no-store" } });
  try {
    const stored = await loadStoredGuide(service, body.data.resourceId);
    if (stored.guide && stored.data) return reply({ ...stored.guide, ...stored.data });

    const loaded = await loadGraphContext(service, auth.userId, body.data.career);
    const resource = loaded.ok ? findResource(loaded.ctx.resources, body.data.resourceId) : null;
    if (!loaded.ok || !resource || resource.kind !== "PROJECT") return NextResponse.json({ error: "That project isn't available." }, { status: 404 });
    const career = loaded.ctx.career.name;
    const call = <T,>(feature: string, prompt: string, system: string, schema: import("zod").ZodType<T>) =>
      loggedCompleteJson(service, { feature, userId: auth.userId, meta: { resource: resource.id } }, prompt, system, schema);

    const [guide, data] = await Promise.allSettled([
      stored.guide ? Promise.resolve(stored.guide) : call("roadmap_project_guide", buildGuidePrompt(resource, career), GUIDE_SYSTEM, ProjectGuide),
      stored.data ? Promise.resolve(stored.data) : call("roadmap_project_data", buildDataPrompt(resource, career), DATA_SYSTEM, ProjectData),
    ]);
    if (guide.status === "rejected") throw guide.reason;
    const dataValue = data.status === "fulfilled" ? data.value : null;
    if (data.status === "rejected") console.warn("[roadmap/project-guide] practice data not written:", data.reason instanceof Error ? data.reason.message : data.reason);
    await saveGuide(service, resource.id, { guide: guide.value, ...(dataValue ? { data: dataValue } : {}) });
    return reply({ ...guide.value, ...(dataValue ?? NO_DATA) });
  } catch (error) {
    console.error("[roadmap/project-guide]", error);
    return NextResponse.json({ error: "Couldn't write the guide just now. Try again in a moment." }, { status: 502 });
  }
}

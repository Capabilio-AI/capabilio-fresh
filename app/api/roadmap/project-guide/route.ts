import { NextResponse, after } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { loadGraphContext } from "@/lib/roadmap-visual/context";
import { GuideBody, findResource, type ProjectGuideView } from "@/lib/roadmap-visual/project-guide";
import { claimWriter, readGuideState } from "@/lib/roadmap-visual/guide-store";
import { writeProjectGuide } from "@/lib/roadmap-visual/guide-writer";

// The writer runs after the response is sent, so it needs room; the request itself answers in well under a second.
export const maxDuration = 300;

const Body = GuideBody.extend({ retry: z.boolean().optional() }).strict();
const NO_STORE = { "Cache-Control": "no-store" };
const FRESH_FAILURE_MS = 2 * 60_000;

/**
 * The guide and practice data for one catalogue project.
 *  - Already written: returned at once ({ status: "ready" }).
 *  - Not written: one background writer is started and the answer is { status: "pending" }; the page asks again every few seconds. The slow
 *    AI work never sits inside a request, so no request can time out, and a hundred students opening the same project start a single writer.
 *  - Failed just now: said at once, until the student presses Try again.
 * Guides are also written ahead of time (hourly top-up and backfill script), so most projects are ready before anyone opens them.
 */
export async function POST(request: Request) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const service = createServiceClient();
  const ready = (guide: ProjectGuideView) => NextResponse.json({ status: "ready", guide }, { headers: NO_STORE });
  const pending = () => NextResponse.json({ status: "pending" }, { status: 202, headers: NO_STORE });

  const state = await readGuideState(service, body.data.resourceId);
  if (state.guide && state.data) return ready({ ...state.guide, ...state.data });
  if (state.writing) return state.guide ? ready({ ...state.guide, datasets: [], realDataIdeas: [] }) : pending();
  if (!body.data.retry && !state.guide && state.failure && state.failure.ageMs < FRESH_FAILURE_MS) {
    return NextResponse.json({ error: "Couldn't write the guide just now. Try again in a moment." }, { status: 502, headers: NO_STORE });
  }

  // starting a writer costs an AI call, so only this path is rate limited (not reading or waiting)
  const limit = await checkRateLimit(auth.userId, { bucket: "roadmap_project_guide", maxRequests: 20, windowSeconds: 600 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);

  try {
    const loaded = await loadGraphContext(service, auth.userId, body.data.career);
    const resource = loaded.ok ? findResource(loaded.ctx.resources, body.data.resourceId) : null;
    if (!loaded.ok || !resource || resource.kind !== "PROJECT") return NextResponse.json({ error: "That project isn't available." }, { status: 404 });

    const claim = await claimWriter(service, resource.id);
    if (claim === "busy") return state.guide ? ready({ ...state.guide, datasets: [], realDataIdeas: [] }) : pending();
    if (claim === "unavailable") {
      // the bookkeeping columns are missing: write it inline, as before
      await writeProjectGuide(service, resource, auth.userId);
      const done = await readGuideState(service, resource.id);
      return done.guide ? ready({ ...done.guide, ...(done.data ?? { datasets: [], realDataIdeas: [] }) }) : NextResponse.json({ error: "Couldn't write the guide just now. Try again in a moment." }, { status: 502 });
    }

    after(async () => {
      try {
        await writeProjectGuide(service, resource, auth.userId);
      } catch (error) {
        console.error("[roadmap/project-guide] background write failed:", error instanceof Error ? error.message : error);
      }
    });
    return state.guide ? ready({ ...state.guide, datasets: [], realDataIdeas: [] }) : pending();
  } catch (error) {
    console.error("[roadmap/project-guide]", error);
    return NextResponse.json({ error: "Couldn't write the guide just now. Try again in a moment." }, { status: 502 });
  }
}

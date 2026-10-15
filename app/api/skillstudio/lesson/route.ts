import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { loggedCompleteJson } from "@/lib/ai/log";
import { loadGraphContext } from "@/lib/roadmap-visual/context";
import { explainNode } from "@/lib/roadmap-visual/explain-node";
import { LESSON_KINDS, TheoryLesson, VideoScript } from "@/lib/skillstudio/lesson-content";
import { LESSON_SYSTEM, buildLessonPrompt } from "@/lib/skillstudio/lesson-prompts";
import { cached } from "@/lib/skillstudio/lesson-cache";

export const maxDuration = 60;

const Body = z.object({ nodeKey: z.string().regex(/^[a-z0-9][a-z0-9-]{1,80}$/), kind: z.enum(LESSON_KINDS) }).strict();

/**
 * A topic's written lesson or narrated explainer script, written by the model from the topic's stored facts only. The same for every
 * learner, so it is shared and cached. Like the tutor, it explains; it never changes a score.
 */
export async function POST(request: Request) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const limit = await checkRateLimit(auth.userId, { bucket: "skillstudio_lesson", maxRequests: 24, windowSeconds: 600 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const service = createServiceClient();
  try {
    const loaded = await loadGraphContext(service, auth.userId, "primary");
    const e = loaded.ok ? explainNode(loaded.ctx, body.data.nodeKey) : null;
    if (!loaded.ok || !e || e.type !== "TOPIC") return NextResponse.json({ error: "That lesson isn't available." }, { status: 404 });

    const { kind } = body.data;
    const prompt = buildLessonPrompt(e, kind, loaded.ctx.career.name);
    const ctx = { feature: `skillstudio_${kind}`, userId: auth.userId, meta: { node: body.data.nodeKey } };
    const lesson = await cached<TheoryLesson | VideoScript>(`${loaded.ctx.career.id}:${body.data.nodeKey}:${kind}`, () =>
      kind === "theory" ? loggedCompleteJson(service, ctx, prompt, LESSON_SYSTEM, TheoryLesson) : loggedCompleteJson(service, ctx, prompt, LESSON_SYSTEM, VideoScript)
    );
    return NextResponse.json({ kind, lesson }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[skillstudio/lesson]", error);
    return NextResponse.json({ error: "We couldn't prepare this lesson just now. Try again in a moment." }, { status: 502 });
  }
}

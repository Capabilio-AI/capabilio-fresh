import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { loggedCompleteJson } from "@/lib/ai/log";
import { loadGraphContext } from "@/lib/roadmap-visual/context";
import { explainNode } from "@/lib/roadmap-visual/explain-node";
import { TUTOR_SYSTEM, TutorBody, TutorReply, buildTutorPrompt } from "@/lib/roadmap-visual/tutor";

export const maxDuration = 60;

/** Learn with AI: Quick Explain, Teach Me, Quiz me, Ask anything, grounded in the topic and the student's own level and syllabus. Never changes a score. */
export async function POST(request: Request) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const limit = await checkRateLimit(auth.userId, { bucket: "roadmap_ai", maxRequests: 30, windowSeconds: 600 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);
  const body = TutorBody.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: body.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });

  const service = createServiceClient();
  try {
    const loaded = await loadGraphContext(service, auth.userId, body.data.career);
    const e = loaded.ok ? explainNode(loaded.ctx, body.data.nodeKey) : null;
    if (!loaded.ok || !e || e.type !== "TOPIC") return NextResponse.json({ error: "That topic isn't available." }, { status: 404 });
    const reply = await loggedCompleteJson(service, { feature: "roadmap_tutor", userId: auth.userId, meta: { mode: body.data.mode, node: body.data.nodeKey } }, buildTutorPrompt(e, body.data.mode, body.data.question, loaded.ctx.career.name), TUTOR_SYSTEM, TutorReply);
    return NextResponse.json({ reply }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[roadmap/ai]", error);
    return NextResponse.json({ error: "The tutor couldn't answer just now. Try again in a moment." }, { status: 502 });
  }
}

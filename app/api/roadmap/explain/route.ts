import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { loadGraphContext } from "@/lib/roadmap-visual/context";
import { explainNode, explainReadiness, explainSubject } from "@/lib/roadmap-visual/explain-node";

const Query = z.object({ type: z.enum(["node", "readiness", "subject"]), id: z.string().max(80).optional(), career: z.enum(["primary", "plan-b"]).default("primary") });

/** The factual payload behind any card or node: score and coverage with formulas, evidence, source snippets, resources and practice. Never AI-written. */
export async function GET(request: Request) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const limit = await checkRateLimit(auth.userId, { bucket: "roadmap_explain", maxRequests: 240, windowSeconds: 600 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);
  const q = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!q.success || (q.data.type !== "readiness" && !q.data.id)) return NextResponse.json({ error: "type and id are required." }, { status: 400 });
  try {
    const loaded = await loadGraphContext(createServiceClient(), auth.userId, q.data.career);
    if (!loaded.ok) return NextResponse.json({ error: "No roadmap for this career yet.", reason: loaded.reason }, { status: 404 });
    const payload = q.data.type === "node" ? explainNode(loaded.ctx, q.data.id!) : q.data.type === "subject" ? explainSubject(loaded.ctx, q.data.id!) : explainReadiness(loaded.ctx);
    return payload ? NextResponse.json({ type: q.data.type, payload }, { headers: { "Cache-Control": "no-store" } }) : NextResponse.json({ error: "Not found." }, { status: 404 });
  } catch (error) {
    console.error("[roadmap/explain]", error);
    return NextResponse.json({ error: "Could not load the details. Try again." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { choosePathway, clearChosenPathway } from "@/lib/pathways/store";

const Body = z.object({ key: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(60) });

async function gate() {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return { error: auth.error };
  const limit = await checkRateLimit(auth.userId, { bucket: "pathway_goal", maxRequests: 30, windowSeconds: 600 });
  return limit.allowed ? { userId: auth.userId } : { error: rateLimitedResponse(limit.remaining) };
}

/** Choose a published pathway as your goal. */
export async function POST(request: Request) {
  const g = await gate();
  if ("error" in g) return g.error;
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Choose a pathway." }, { status: 400 });
  try {
    return (await choosePathway(createServiceClient(), g.userId, body.data.key)) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "That pathway is not available." }, { status: 404 });
  } catch (e) {
    console.error("[pathways] choose failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Could not save your goal. Please try again." }, { status: 500 });
  }
}

/** Let go of the chosen pathway. */
export async function DELETE() {
  const g = await gate();
  if ("error" in g) return g.error;
  try {
    await clearChosenPathway(createServiceClient(), g.userId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[pathways] clear failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Could not change your goal. Please try again." }, { status: 500 });
  }
}

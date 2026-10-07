import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { getCareerIntent } from "@/lib/careers/intent";
import { chooseDomainCareer } from "@/lib/arena-challenges/career-state";
import { ResponseSchema } from "@/lib/roadmap-visual/diagnostic";
import { DiagnosticError, answerDiagnostic, getDiagnostic, skipDiagnostic, startDiagnostic } from "@/lib/roadmap-visual/diagnostic-store";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), retake: z.boolean().optional() }).strict(),
  z.object({ action: z.literal("answer"), itemId: z.string().uuid(), response: ResponseSchema }).strict(),
  z.object({ action: z.literal("skip") }).strict(),
]);

/** The baseline check for the caller's chosen career. Answer keys never leave the server. */
export async function GET(request: Request) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const careerId = await careerOf(auth.userId, new URL(request.url).searchParams.get("career"));
  try {
    return NextResponse.json(await getDiagnostic(createServiceClient(), auth.userId, careerId), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[roadmap/diagnostic]", error);
    return NextResponse.json({ error: "Could not load the check. Try again." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const limit = await checkRateLimit(auth.userId, { bucket: "roadmap_diagnostic", maxRequests: 200, windowSeconds: 3600 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const careerId = await careerOf(auth.userId, new URL(request.url).searchParams.get("career"));
  if (!careerId) return NextResponse.json({ error: "Choose a career first." }, { status: 409 });
  const service = createServiceClient();
  try {
    if (body.data.action === "start") return NextResponse.json(await startDiagnostic(service, auth.userId, careerId, body.data.retake));
    if (body.data.action === "skip") {
      await skipDiagnostic(service, auth.userId, careerId);
      return NextResponse.json(await getDiagnostic(service, auth.userId, careerId));
    }
    return NextResponse.json(await answerDiagnostic(service, auth.userId, careerId, body.data.itemId, body.data.response));
  } catch (error) {
    if (error instanceof DiagnosticError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[roadmap/diagnostic]", error);
    return NextResponse.json({ error: "Could not save. Try again." }, { status: 500 });
  }
}

async function careerOf(userId: string, which: string | null) {
  const { intent } = await getCareerIntent(createServiceClient(), userId);
  const chosen = chooseDomainCareer(intent, which === "plan-b" ? "plan-b" : "primary");
  return chosen.state === "ready" ? chosen.career.id : null;
}

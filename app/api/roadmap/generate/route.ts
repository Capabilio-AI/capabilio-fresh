import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { getCareerIntent } from "@/lib/careers/intent";
import { chooseDomainCareer } from "@/lib/arena-challenges/career-state";
import { executeRun, requestGeneration, roadmapState } from "@/lib/roadmap-generate/runs";

// The generation runs after the response, so the function needs the full window.
export const maxDuration = 300;

async function careerOf(service: ReturnType<typeof createServiceClient>, userId: string, which: string | null): Promise<string | null> {
  const { intent } = await getCareerIntent(service, userId);
  const chosen = chooseDomainCareer(intent, which === "plan-b" ? "plan-b" : "primary");
  return chosen.state === "ready" ? chosen.career.id : null;
}

/** Where the student's career roadmap stands: READY, RUNNING (being built), FAILED or IDLE. */
export async function GET(request: Request) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const service = createServiceClient();
  const careerId = await careerOf(service, auth.userId, new URL(request.url).searchParams.get("career"));
  if (!careerId) return NextResponse.json({ error: "Choose a career first." }, { status: 409 });
  return NextResponse.json(await roadmapState(service, careerId), { headers: { "Cache-Control": "no-store" } });
}

/** Starts building the roadmap for the student's own career when it has none. Idempotent: at most one run per career, and a failed run cools down. */
export async function POST(request: Request) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const limit = await checkRateLimit(auth.userId, { bucket: "roadmap_generate", maxRequests: 12, windowSeconds: 3600 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);
  const service = createServiceClient();
  const careerId = await careerOf(service, auth.userId, new URL(request.url).searchParams.get("career"));
  if (!careerId) return NextResponse.json({ error: "Choose a career first." }, { status: 409 });

  const started = await requestGeneration(service, careerId);
  if (started.state === "STARTED") {
    after(() => executeRun(service, started.runId, careerId));
    return NextResponse.json({ state: "RUNNING" }, { status: 202 });
  }
  if (started.state === "COOLDOWN") return NextResponse.json({ state: "FAILED", message: started.message }, { status: 200 });
  return NextResponse.json({ state: started.state }, { status: started.state === "RUNNING" ? 202 : 200 });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { studentOnlyResponse } from "@/lib/stage/guard";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { loadStreamGate } from "@/lib/arena-challenges/stream-gate";
import { getMissionState, runMissionTest, takeMissionHint, type MissionError, type MissionView } from "@/lib/arena-challenges/missions/service";

export const maxDuration = 60;

const Body = z.object({ challengeId: z.string().uuid(), action: z.enum(["test", "hint"]), settings: z.record(z.string(), z.union([z.string(), z.number()])).optional() });

async function guard() {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return { response: auth.error } as const;
  const notStudent = await studentOnlyResponse(auth.userId);
  if (notStudent) return { response: notStudent } as const;
  const service = createServiceClient();
  if (!(await loadStreamGate(service, auth.userId)).open) return { response: NextResponse.json({ error: "Stream challenges open in 2nd year." }, { status: 403 }) } as const;
  return { userId: auth.userId, service } as const;
}

const reply = (r: MissionView | MissionError) => ("error" in r ? NextResponse.json({ error: r.error }, { status: r.status }) : NextResponse.json(r));

/** The student's progress on one mission: what the lab looks like, how many tests and hints they have used, and whether it is done. */
export async function GET(request: Request) {
  const g = await guard();
  if ("response" in g) return g.response;
  const id = z.string().uuid().safeParse(new URL(request.url).searchParams.get("challengeId"));
  if (!id.success) return NextResponse.json({ error: "Invalid mission." }, { status: 400 });
  return reply(await getMissionState(g.service, g.userId, id.data));
}

export async function POST(request: Request) {
  const g = await guard();
  if ("response" in g) return g.response;
  const limit = await checkRateLimit(g.userId, { bucket: "arena_mission", maxRequests: 60, windowSeconds: 60 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { challengeId, action, settings } = body.data;
  return reply(action === "test" ? await runMissionTest(g.service, g.userId, challengeId, settings) : await takeMissionHint(g.service, g.userId, challengeId, settings));
}

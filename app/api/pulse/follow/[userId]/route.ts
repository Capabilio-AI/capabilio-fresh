import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { follow, unfollow, type GraphResult } from "@/lib/pulse/graph";

type Ctx = { params: Promise<{ userId: string }> };

async function act(params: Ctx["params"], run: (service: ReturnType<typeof createServiceClient>, me: string, other: string) => Promise<GraphResult>) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const id = z.string().uuid().safeParse((await params).userId);
  if (!id.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const limit = await checkRateLimit(auth.userId, { bucket: "pulse_follow", maxRequests: 60, windowSeconds: 3600 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);
  const result = await run(createServiceClient(), auth.userId, id.data);
  return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.message }, { status: result.status });
}

export const POST = (_r: Request, { params }: Ctx) => act(params, follow);
export const DELETE = (_r: Request, { params }: Ctx) => act(params, unfollow);

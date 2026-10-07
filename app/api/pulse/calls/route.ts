import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { startCall } from "@/lib/pulse/calls";

const Body = z.object({ userId: z.string().uuid(), kind: z.enum(["voice", "video"]) }).strict();

/** Start a call. Only between people whose conversation is accepted. Returns the ICE servers to connect with. */
export async function POST(request: Request) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const limit = await checkRateLimit(auth.userId, { bucket: "call_start", maxRequests: 20, windowSeconds: 600 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const result = await startCall(createServiceClient(), auth.userId, body.data.userId, body.data.kind);
  return result.ok ? NextResponse.json({ ok: true, call: result.call, ice: result.ice }, { status: 201 }) : NextResponse.json({ error: result.message }, { status: result.status });
}

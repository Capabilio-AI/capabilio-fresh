import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { relaySignal } from "@/lib/pulse/calls";

const Body = z.object({ kind: z.enum(["offer", "answer", "candidate"]), data: z.unknown() }).strict();

/** Relays WebRTC signalling (offer, answer, ICE candidates) to the other person in the call. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const limit = await checkRateLimit(auth.userId, { bucket: "call_signal", maxRequests: 600, windowSeconds: 60 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);
  const id = z.string().uuid().safeParse((await params).id);
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!id.success || !body.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const result = await relaySignal(createServiceClient(), auth.userId, id.data, { kind: body.data.kind, data: body.data.data });
  return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.message }, { status: result.status });
}

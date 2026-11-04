import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { inviteToCall } from "@/lib/pulse/calls";

const UUID = /^[0-9a-f-]{36}$/i;
const Body = z.object({ userIds: z.array(z.string().uuid()).min(1).max(7) }).strict();

/** Add people to a call that is under way. Each is rung like a normal call. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Call not found." }, { status: 404 });
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const limit = await checkRateLimit(auth.userId, { bucket: "call_invite", maxRequests: 30, windowSeconds: 600 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const result = await inviteToCall(createServiceClient(), auth.userId, id, body.data.userIds);
  return result.ok ? NextResponse.json({ invited: result.invited, skipped: result.skipped }) : NextResponse.json({ error: result.message }, { status: result.status });
}

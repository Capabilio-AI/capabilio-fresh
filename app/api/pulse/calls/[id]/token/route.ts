import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { issueCallToken } from "@/lib/pulse/calls";

const UUID = /^[0-9a-f-]{36}$/i;

/** A short-lived token for joining this call's room. Only for people in the call, and only while it is under way. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Call not found." }, { status: 404 });
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const limit = await checkRateLimit(auth.userId, { bucket: "call_token", maxRequests: 60, windowSeconds: 600 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);
  const result = await issueCallToken(createServiceClient(), auth.userId, id);
  return result.ok ? NextResponse.json({ token: result.token, url: result.url }, { headers: { "Cache-Control": "no-store" } }) : NextResponse.json({ error: result.message }, { status: result.status });
}

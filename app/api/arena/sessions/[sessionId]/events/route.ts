import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { recordClientEvent } from "@/lib/arena-roles/session/service";
import { supabaseSessionStore } from "@/lib/arena-roles/session/supabase-store";
import { sessionErrorResponse } from "@/lib/arena-roles/session/http";

/** What the browser reports (opened the brief, looked at a table, wrote a plan). Only those kinds are accepted, and they are stored as lower-trust. */
export async function POST(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;
  const rateLimit = await checkRateLimit(auth.userId, { bucket: "arena_session_event", maxRequests: 60, windowSeconds: 60 });
  if (!rateLimit.allowed) return rateLimitedResponse(rateLimit.remaining);
  const { sessionId } = await params;
  try {
    await recordClientEvent(supabaseSessionStore(createServiceClient()), { userId: auth.userId, sessionId, event: await request.json().catch(() => null) });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return sessionErrorResponse(error, "arena/sessions/events");
  }
}

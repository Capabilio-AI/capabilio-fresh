import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { EventsBody, recordIntegrityBatch } from "@/lib/integrity/record";

/** A batch of counts from the page guard. The guard never blocks on this: a failed send only loses the count. */
export async function POST(request: Request) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const limit = await checkRateLimit(auth.userId, { bucket: "integrity_events", maxRequests: 30, windowSeconds: 60 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);
  const body = EventsBody.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  try {
    await recordIntegrityBatch(createServiceClient(), auth.userId, body.data);
  } catch (e) {
    console.error("[integrity] could not store a batch:", e);
    return NextResponse.json({ error: "Could not store events." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

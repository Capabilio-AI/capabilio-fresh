import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { untyped } from "@/lib/org/db";

const Schema = z
  .object({
    targetType: z.enum(["user", "post", "comment", "story"]),
    targetId: z.string().uuid(),
    reason: z.enum(["spam", "harassment", "inappropriate", "impersonation", "other"]),
    details: z.string().trim().max(1000).optional(),
  })
  .strict();

/** A person reports a profile, post, comment or story. One report per target per person; the Capabilio team reviews the queue. */
export async function POST(request: Request) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const limit = await checkRateLimit(auth.userId, { bucket: "pulse_report", maxRequests: 20, windowSeconds: 3600 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a reason for the report." }, { status: 400 });
  const { targetType, targetId, reason, details } = parsed.data;
  const { error } = await untyped(createServiceClient())
    .from("pulse_reports")
    .upsert({ reporter_id: auth.userId, target_type: targetType, target_id: targetId, reason, details: details || null }, { onConflict: "reporter_id,target_type,target_id", ignoreDuplicates: true });
  if (error) {
    console.error("[pulse] report failed:", error.message);
    return NextResponse.json({ error: "Couldn't send the report. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}

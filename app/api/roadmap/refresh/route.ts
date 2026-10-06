import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { ensureRoadmap } from "@/lib/roadmap-engine/service";

export const maxDuration = 60;

/** "Refresh roadmap": recompute from current inputs. If nothing changed, nothing is written and the response says it is up to date. */
export async function POST() {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const limit = await checkRateLimit(auth.userId, { bucket: "roadmap_refresh", maxRequests: 10, windowSeconds: 3600 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);
  const r = await ensureRoadmap(createServiceClient(), auth.userId, { refresh: true });
  if (r.status !== "READY") return NextResponse.json({ status: r.status, ...("reason" in r ? { reason: r.reason } : {}) });
  return NextResponse.json({ status: "READY", created: r.created, upToDate: !r.created, trigger: r.trigger, roadmap: r.view });
}

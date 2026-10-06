import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { ensureRoadmap } from "@/lib/roadmap-engine/service";

/**
 * The signed-in student's own roadmap, brought up to date with their current inputs (a new version is written only if something changed).
 * When it can't be built, says exactly what is missing — never an empty or invented roadmap.
 */
export async function GET() {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const r = await ensureRoadmap(createServiceClient(), auth.userId);
  if (r.status !== "READY") return NextResponse.json({ status: r.status, ...("reason" in r ? { reason: r.reason } : {}), ...("careerName" in r ? { careerName: r.careerName } : {}) });
  return NextResponse.json({ status: "READY", created: r.created, trigger: r.trigger, roadmap: r.view });
}

import { NextResponse, after } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { executeRun, nextCareerDue, requestGeneration } from "@/lib/roadmap-generate/runs";

export const maxDuration = 300;

/** Daily (see vercel.json). Builds the roadmap of a career that has none, or refreshes the oldest AI roadmap older than 30 days: one career per call. Fails closed without CRON_SECRET. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const service = createServiceClient();
  try {
    const due = await nextCareerDue(service);
    if (!due) return NextResponse.json({ ok: true, due: null });
    const started = await requestGeneration(service, due.careerId, { force: due.reason === "STALE" });
    if (started.state !== "STARTED") return NextResponse.json({ ok: true, due, skipped: started.state });
    after(() => executeRun(service, started.runId, due.careerId));
    return NextResponse.json({ ok: true, due, started: true });
  } catch (error) {
    console.error("[roadmap-refresh]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Refresh failed" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { untyped } from "@/lib/org/db";
import { announceOpen, closeOutCycle } from "@/lib/crt/org";
import { todayIst } from "@/lib/crt/server";

export const maxDuration = 300;

/** Daily: tells students a cycle is open, and sends the placement cell its results once a cycle has closed. Fails closed without CRON_SECRET. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = untyped(createServiceClient());
  const today = todayIst();
  const [{ data: open }, { data: closed }] = await Promise.all([
    db.from("crt_cycles").select("id, college_id").lte("opens_on", today).gte("closes_on", today).limit(200),
    db.from("crt_cycles").select("id").lt("closes_on", today).is("report_sent_at", null).limit(200),
  ]);
  const service = createServiceClient();
  let announced = 0;
  for (const c of (open ?? []) as { id: string; college_id: string }[]) announced += await announceOpen(service, c.college_id, c.id).catch((e) => (console.error("[crt cron open]", e instanceof Error ? e.message : e), 0));
  let reported = 0;
  for (const c of (closed ?? []) as { id: string }[]) if (await closeOutCycle(service, c.id).catch((e) => (console.error("[crt cron close]", e instanceof Error ? e.message : e), false))) reported++;
  return NextResponse.json({ announced, reported });
}

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { purgeExpired } from "@/lib/pulse/stories";

/** Daily (see vercel.json). Expired stories are already invisible to readers; this frees their rows and images. Fails closed without CRON_SECRET. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const service = createServiceClient();
    const purged = await purgeExpired(service);
    // rate-limit windows are only meaningful for their own window; the per-IP rows have no user to cascade-delete them
    const { error } = await service.from("rate_limit_hits").delete().lt("window_start", new Date(Date.now() - 2 * 86_400_000).toISOString());
    if (error) throw error;
    return NextResponse.json({ ok: true, purged });
  } catch (error) {
    console.error("[stories-cleanup]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }
}

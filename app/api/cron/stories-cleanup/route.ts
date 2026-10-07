import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { purgeExpired } from "@/lib/pulse/stories";

/** Daily (see vercel.json). Expired stories are already invisible to readers; this frees their rows and images. Fails closed without CRON_SECRET. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, purged: await purgeExpired(createServiceClient()) });
  } catch (error) {
    console.error("[stories-cleanup]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }
}

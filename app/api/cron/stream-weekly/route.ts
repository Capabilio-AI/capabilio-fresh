import { NextResponse, after } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { generateWeeklyChallenges } from "@/lib/arena-challenges/leetcode/weekly";

export const maxDuration = 300;

/** Sunday 00:00 IST (Saturday 18:30 UTC) and again after it, see vercel.json: writes this week's IT problems. Idempotent. Fails closed without CRON_SECRET. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const service = createServiceClient();
  after(() => generateWeeklyChallenges(service));
  return NextResponse.json({ ok: true, started: true });
}

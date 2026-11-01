import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { untyped } from "@/lib/org/db";
import { notify } from "@/lib/notifications/notify";
import { studentsWhoCanRegister } from "@/lib/notifications/audiences";
import { closesOn, istToday, nextDay, reminderCopy, reminderWindow } from "@/lib/org/visit-reminders";

const MAX_VISITS_PER_RUN = 200;

/**
 * Daily (see vercel.json). For every company visit still open for registration that closes today or tomorrow, reminds the students who can
 * register but have not. Each student is told once per visit and window (de-duplicated by key), so a re-run or a retry never repeats it.
 * Fails closed: without a matching CRON_SECRET nothing runs.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const service = createServiceClient();
  const db = untyped(service);
  const today = istToday(new Date());
  const dates = `${today},${nextDay(today)}`;

  const { data, error } = await db
    .from("opportunities")
    .select("id, institution_id, company, role, deadline, drive_date, eligible_branches")
    .eq("drive_status", "registration_open")
    .not("institution_id", "is", null)
    .or(`deadline.in.(${dates}),and(deadline.is.null,drive_date.in.(${dates}))`)
    .limit(MAX_VISITS_PER_RUN);
  if (error) {
    console.error("visit reminders query failed", error);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  let visits = 0;
  let reminded = 0;
  for (const v of (data ?? []) as { id: string; institution_id: string; company: string; role: string; deadline: string | null; drive_date: string | null; eligible_branches: string[] | null }[]) {
    const window = reminderWindow(closesOn(v), today);
    if (!window) continue;
    const { data: apps } = await service.from("applications").select("user_id").eq("opportunity_id", v.id);
    const registered = new Set((apps ?? []).map((a) => a.user_id));
    const audience = await studentsWhoCanRegister(service, v.institution_id, v.eligible_branches, registered);
    const copy = reminderCopy(v.company, v.role, window);
    reminded += await notify(service, { userIds: audience, type: "drive_reminder", ...copy, href: "/launchpad", institutionId: v.institution_id, dedupeKey: `drive-remind:${v.id}:${window}` });
    visits++;
  }
  return NextResponse.json({ visits, reminded });
}

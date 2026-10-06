import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

const MAX_PER_RUN = 50;

/**
 * Daily (see vercel.json). Removes student accounts whose roll number is still missing or doesn't carry their
 * college's code once the 7-day deadline has passed. Only accounts that hold nothing but a student membership are
 * touched, and at most MAX_PER_RUN per run. Fails closed: without a matching CRON_SECRET nothing runs.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const service = createServiceClient();
  const { data: due, error } = await service
    .from("institution_memberships")
    .select("user_id")
    .eq("role", "student")
    .eq("roll_number_status", "flagged")
    .lt("roll_number_due_at", new Date().toISOString())
    .order("roll_number_due_at")
    .limit(MAX_PER_RUN);
  if (error) {
    console.error("roll-number cleanup query failed", error);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  const userIds = [...new Set((due ?? []).map((m) => m.user_id))];
  let removed = 0;
  for (const id of userIds) {
    const { count } = await service.from("institution_memberships").select("id", { count: "exact", head: true }).eq("user_id", id).neq("role", "student");
    if ((count ?? 0) > 0) continue; // also staff somewhere: never auto-remove
    const { error: deleteError } = await service.auth.admin.deleteUser(id);
    if (deleteError) console.error("roll-number cleanup: could not remove", id, deleteError.message);
    else removed += 1;
  }
  return NextResponse.json({ ok: true, checked: userIds.length, removed });
}

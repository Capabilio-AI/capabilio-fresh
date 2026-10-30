import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isBulkFlag } from "@/lib/org/roll-number";

const MAX_PER_RUN = 50;

/**
 * Daily (see vercel.json). Removes student accounts whose roll number is still missing or doesn't carry their
 * college's code once the 7-day deadline has passed. Only accounts that hold nothing but a student membership are
 * touched, and at most MAX_PER_RUN per run. A college with a bulk flag (see isBulkFlag) is skipped. Fails closed: without a matching CRON_SECRET nothing runs.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const service = createServiceClient();
  const nowIso = new Date().toISOString();
  const { data: due, error } = await service
    .from("institution_memberships")
    .select("user_id, institution_id")
    .eq("role", "student")
    .eq("roll_number_status", "flagged")
    .lt("roll_number_due_at", nowIso)
    .order("roll_number_due_at")
    .limit(MAX_PER_RUN);
  if (error) {
    console.error("roll-number cleanup query failed", error);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  // circuit breaker, per college: a bulk flag means something upstream broke, so don't delete anyone there this run
  const blocked = new Set<string>();
  for (const institutionId of new Set((due ?? []).map((m) => m.institution_id))) {
    const [flagged, total] = await Promise.all([
      service.from("institution_memberships").select("id", { count: "exact", head: true }).eq("institution_id", institutionId).eq("role", "student").eq("roll_number_status", "flagged").lt("roll_number_due_at", nowIso),
      service.from("institution_memberships").select("id", { count: "exact", head: true }).eq("institution_id", institutionId).eq("role", "student"),
    ]);
    if (flagged.error || total.error) {
      console.error("roll-number cleanup: could not size flags, skipping college", institutionId, flagged.error?.message ?? total.error?.message);
      blocked.add(institutionId);
    } else if (isBulkFlag(flagged.count ?? 0, total.count ?? 0)) {
      console.error(`roll-number cleanup: ${flagged.count} of ${total.count} students flagged at college ${institutionId}; skipping deletions (likely a code/config change)`);
      blocked.add(institutionId);
    }
  }

  const userIds = [...new Set((due ?? []).filter((m) => !blocked.has(m.institution_id)).map((m) => m.user_id))];
  let removed = 0;
  for (const id of userIds) {
    const { count } = await service.from("institution_memberships").select("id", { count: "exact", head: true }).eq("user_id", id).neq("role", "student");
    if ((count ?? 0) > 0) continue; // also staff somewhere: never auto-remove
    const { error: deleteError } = await service.auth.admin.deleteUser(id);
    if (deleteError) console.error("roll-number cleanup: could not remove", id, deleteError.message);
    else removed += 1;
  }
  return NextResponse.json({ ok: true, checked: userIds.length, removed, skippedColleges: blocked.size });
}

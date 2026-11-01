import { NextResponse } from "next/server";
import { orgRoute } from "@/lib/api/org-route";
import { VisitStatusSchema } from "@/lib/org/schemas";
import { untyped } from "@/lib/org/db";
import { canMoveVisit } from "@/lib/org/visits";
import { notify } from "@/lib/notifications/notify";
import { notifyVisitOpened } from "@/lib/notifications/visit-open";

/** Move a company visit through planned → registration open → completed (or cancelled). Own college only. */
export async function POST(request: Request) {
  return orgRoute(request, VisitStatusSchema, "postPlacement", async ({ ctx, service }, body) => {
    const { data: current } = await untyped(service).from("opportunities").select("drive_status").eq("id", body.opportunityId).eq("institution_id", ctx.institutionId).maybeSingle();
    if (current && !canMoveVisit((current as { drive_status: string }).drive_status, body.status)) {
      return NextResponse.json({ error: "A completed company visit can't be reopened for registration." }, { status: 409 });
    }
    const { data, error } = await untyped(service).from("opportunities").update({ drive_status: body.status }).eq("id", body.opportunityId).eq("institution_id", ctx.institutionId).select("id, company, role, deadline, eligible_branches");
    if (error) throw error;
    if (!data || data.length === 0) return NextResponse.json({ error: "Company visit not found." }, { status: 404 });
    const visit = data[0] as { id: string; company: string; role: string; deadline: string | null; eligible_branches: string[] | null };
    const db = untyped(service);
    if (body.status === "registration_open") {
      await notifyVisitOpened(service, ctx.institutionId, visit, ctx.userId);
    } else if (body.status === "cancelled" || body.status === "completed") {
      // people who registered hear how it ended
      const { data: apps } = await db.from("applications").select("user_id").eq("opportunity_id", visit.id);
      await notify(service, {
        userIds: ((apps ?? []) as { user_id: string }[]).map((a) => a.user_id),
        type: `drive_${body.status}`,
        title: body.status === "cancelled" ? `${visit.company}'s visit was cancelled` : `${visit.company}'s visit is complete`,
        href: "/launchpad",
        actorId: ctx.userId,
        institutionId: ctx.institutionId,
        dedupeKey: `drive-${body.status}:${visit.id}`,
      });
    }
    return {};
  });
}

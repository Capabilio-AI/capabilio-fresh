import { NextResponse } from "next/server";
import { orgRoute } from "@/lib/api/org-route";
import { VisitStatusSchema } from "@/lib/org/schemas";
import { untyped } from "@/lib/org/db";
import { notify } from "@/lib/notifications/notify";
import { activeStudents } from "@/lib/notifications/audiences";

/** Move a company visit through planned → registration open → completed (or cancelled). Own college only. */
export async function POST(request: Request) {
  return orgRoute(request, VisitStatusSchema, "postPlacement", async ({ ctx, service }, body) => {
    const { data, error } = await untyped(service).from("opportunities").update({ drive_status: body.status }).eq("id", body.opportunityId).eq("institution_id", ctx.institutionId).select("id, company, eligible_branches");
    if (error) throw error;
    if (!data || data.length === 0) return NextResponse.json({ error: "Company visit not found." }, { status: 404 });
    const visit = data[0] as { id: string; company: string; eligible_branches: string[] | null };
    const db = untyped(service);
    if (body.status === "registration_open") {
      await notify(service, {
        userIds: await activeStudents(service, ctx.institutionId, visit.eligible_branches),
        type: "drive_open",
        title: `Registration is open: ${visit.company}`,
        href: "/launchpad",
        actorId: ctx.userId,
        institutionId: ctx.institutionId,
        dedupeKey: `drive-open:${visit.id}`,
      });
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

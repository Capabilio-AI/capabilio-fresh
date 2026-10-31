import { NextResponse } from "next/server";
import { orgRoute } from "@/lib/api/org-route";
import { DeleteVisitSchema } from "@/lib/org/schemas";
import { untyped } from "@/lib/org/db";
import { notify } from "@/lib/notifications/notify";

/**
 * Remove a company visit of this college. Registrations go with it (and those students are told). A visit that already has a confirmed
 * placement is refused: that record is part of the college's results, so it is marked completed or cancelled instead.
 */
export async function POST(request: Request) {
  return orgRoute(request, DeleteVisitSchema, "postPlacement", async ({ ctx, service }, body) => {
    const db = untyped(service);
    const { data: visit } = await db.from("opportunities").select("id, company").eq("id", body.opportunityId).eq("institution_id", ctx.institutionId).maybeSingle();
    if (!visit) return NextResponse.json({ error: "Company visit not found." }, { status: 404 });
    const { count } = await db.from("org_placements").select("id", { count: "exact", head: true }).eq("opportunity_id", body.opportunityId);
    if ((count ?? 0) > 0) return NextResponse.json({ error: "This visit has confirmed placements, so it can't be deleted. Mark it completed or cancelled instead." }, { status: 409 });

    const { data: apps } = await db.from("applications").select("user_id").eq("opportunity_id", body.opportunityId);
    const { error } = await db.from("opportunities").delete().eq("id", body.opportunityId).eq("institution_id", ctx.institutionId);
    if (error) throw error;
    await notify(service, {
      userIds: ((apps ?? []) as { user_id: string }[]).map((a) => a.user_id),
      type: "drive_cancelled",
      title: `${(visit as { company: string }).company}'s visit was removed`,
      href: "/launchpad",
      actorId: ctx.userId,
      institutionId: ctx.institutionId,
      dedupeKey: `drive-removed:${body.opportunityId}`,
    });
    return {};
  });
}

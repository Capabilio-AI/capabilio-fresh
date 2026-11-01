import { NextResponse } from "next/server";
import { orgRoute } from "@/lib/api/org-route";
import { ApplySchema } from "@/lib/org/schemas";
import { untyped } from "@/lib/org/db";
import { canWithdraw } from "@/lib/org/visits";
import { notify } from "@/lib/notifications/notify";
import { staffWithPermission } from "@/lib/notifications/audiences";

/**
 * A student takes back their OWN registration for a company visit at their own college. Allowed only while it is still a registration or a
 * shortlisting and the visit has not finished; never after the college selected them or released an offer. The college is told.
 */
export async function POST(request: Request) {
  return orgRoute(request, ApplySchema, "applyToDrive", async ({ ctx, service }, body) => {
    const { data: opp } = await untyped(service).from("opportunities").select("id, institution_id, company, drive_status").eq("id", body.opportunityId).maybeSingle();
    const visit = opp as { id: string; institution_id: string | null; company: string; drive_status: string } | null;
    if (!visit || visit.institution_id !== ctx.institutionId) return NextResponse.json({ error: "Company visit not found." }, { status: 404 });

    const { data: app } = await service.from("applications").select("id, status").eq("opportunity_id", visit.id).eq("user_id", ctx.userId).maybeSingle();
    if (!app) return NextResponse.json({ error: "You haven't registered for this visit." }, { status: 404 });
    if (!canWithdraw(app.status, visit.drive_status)) return NextResponse.json({ error: "This registration can no longer be withdrawn. Contact your placement office." }, { status: 409 });
    const { data: offer } = await untyped(service).from("org_placements").select("id").eq("opportunity_id", visit.id).eq("student_user_id", ctx.userId).order("id").limit(1);
    if (offer && offer.length > 0) return NextResponse.json({ error: "An offer has already been released to you, so you can't withdraw." }, { status: 409 });

    const { error } = await service.from("applications").delete().eq("id", app.id).eq("user_id", ctx.userId);
    if (error) throw error;
    const { data: me } = await service.from("profiles").select("full_name").eq("id", ctx.userId).maybeSingle();
    await notify(service, {
      userIds: await staffWithPermission(service, ctx.institutionId, "placements"),
      type: "drive_withdrawal",
      title: `${me?.full_name ?? "A student"} withdrew from ${visit.company}`,
      href: `/org/placements/${visit.id}`,
      actorId: ctx.userId,
      institutionId: ctx.institutionId,
      dedupeKey: `withdraw:${app.id}`,
    });
    return {};
  });
}

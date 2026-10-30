import { NextResponse } from "next/server";
import { orgRoute } from "@/lib/api/org-route";
import { ApplicationStatusSchema } from "@/lib/org/schemas";
import { untyped } from "@/lib/org/db";
import { notify } from "@/lib/notifications/notify";

/** TPO/admin move an applicant through the pipeline — only for drives of THEIR institution. */
export async function POST(request: Request) {
  return orgRoute(request, ApplicationStatusSchema, "postPlacement", async ({ ctx, service }, body) => {
    const { data: app } = await service.from("applications").select("id, opportunity_id, user_id").eq("id", body.applicationId).maybeSingle();
    const { data: opp } = app ? await service.from("opportunities").select("institution_id, company, role").eq("id", app.opportunity_id).maybeSingle() : { data: null };
    if (!app || !opp || opp.institution_id !== ctx.institutionId) return NextResponse.json({ error: "Application not found." }, { status: 404 });
    // once the offer is released the student is placed: the page hides "Not selected" then, so the API refuses it too
    if (body.status === "rejected") {
      const { data: offer } = await untyped(service).from("org_placements").select("id").eq("opportunity_id", app.opportunity_id).eq("student_user_id", app.user_id).order("id").limit(1);
      if (offer && offer.length > 0) return NextResponse.json({ error: "An offer has already been released to this student, so they can't be marked as not selected." }, { status: 409 });
    }
    const { error } = await service.from("applications").update({ status: body.status }).eq("id", app.id);
    if (error) throw error;
    const label = body.status.replace(/_/g, " ");
    await notify(service, {
      userIds: [app.user_id],
      type: "application_status",
      title: `Your application to ${opp.company} is now ${label}`,
      body: opp.role,
      href: "/launchpad",
      actorId: ctx.userId,
      institutionId: ctx.institutionId,
      dedupeKey: `app:${app.id}:${body.status}`,
    });
    return {};
  });
}

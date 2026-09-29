import { NextResponse } from "next/server";
import { orgRoute } from "@/lib/api/org-route";
import { ConfirmPlacementSchema } from "@/lib/org/schemas";
import { untyped } from "@/lib/org/db";

/**
 * TPO/admin confirm a placement. There is deliberately no self-report path: a placement exists only because a
 * named college officer confirmed it for an ACTIVE student of that same college.
 */
export async function POST(request: Request) {
  return orgRoute(request, ConfirmPlacementSchema, "postPlacement", async ({ ctx, service }, body) => {
    let studentUserId = body.studentUserId;
    let opportunityId: string | null = null;
    let company = body.company;
    let roleTitle = body.roleTitle;

    if (body.applicationId) {
      const { data: app } = await service.from("applications").select("id, user_id, opportunity_id, status").eq("id", body.applicationId).maybeSingle();
      const { data: opp } = app ? await service.from("opportunities").select("id, institution_id, company, role").eq("id", app.opportunity_id).maybeSingle() : { data: null };
      if (!app || !opp || opp.institution_id !== ctx.institutionId) return NextResponse.json({ error: "Application not found." }, { status: 404 });
      if (app.status !== "accepted") return NextResponse.json({ error: "Mark the applicant as selected before confirming a placement." }, { status: 409 });
      studentUserId = app.user_id;
      opportunityId = opp.id;
      company = company ?? opp.company;
      roleTitle = roleTitle ?? opp.role;
    }

    const { data: student } = await service
      .from("institution_memberships")
      .select("id")
      .eq("user_id", studentUserId!)
      .eq("institution_id", ctx.institutionId)
      .eq("role", "student")
      .eq("status", "active")
      .maybeSingle();
    if (!student) return NextResponse.json({ error: "That person isn't an active student of your institution." }, { status: 404 });

    const { data: saved, error } = await untyped(service).from("org_placements").upsert(
      {
        institution_id: ctx.institutionId,
        student_user_id: studentUserId,
        opportunity_id: opportunityId,
        company,
        role_title: roleTitle,
        ctc_lpa: body.ctcLpa ?? null,
        offer_date: body.offerDate ?? null,
        confirmed_by_membership_id: ctx.membershipId,
      },
      { onConflict: "institution_id,student_user_id,company,role_title" }
    ).select("id").single();
    if (error) throw error;
    return { placementId: (saved as { id: string }).id };
  });
}

import { orgRoute } from "@/lib/api/org-route";
import { PlacementSchema } from "@/lib/org/schemas";
import { untyped } from "@/lib/org/db";

/**
 * Record a company visit the college has confirmed. It is an `opportunities` row pinned to the caller's institution,
 * readable only by that college's active members (RLS), so students of other colleges never see it.
 */
export async function POST(request: Request) {
  return orgRoute(request, PlacementSchema, "postPlacement", async ({ ctx, service }, body) => {
    const { data, error } = await untyped(service)
      .from("opportunities")
      .insert({
        institution_id: ctx.institutionId,
        created_by: ctx.userId,
        role: body.role,
        company: body.company,
        location: body.location ?? null,
        opportunity_type: body.opportunityType,
        skills: body.skills,
        eligibility: body.eligibility ?? null,
        deadline: body.deadline ?? null,
        drive_date: body.driveDate ?? null,
        drive_status: body.status,
        ctc_offered: body.ctcOffered ?? null,
        eligible_branches: body.eligibleBranches?.length ? body.eligibleBranches : null,
      })
      .select("id")
      .single();
    if (error) throw error;
    return { visitId: data.id as string };
  });
}

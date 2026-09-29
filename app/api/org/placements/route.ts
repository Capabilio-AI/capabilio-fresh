import { orgRoute } from "@/lib/api/org-route";
import { PlacementSchema } from "@/lib/org/schemas";

/** A placement drive is an `opportunities` row pinned to the caller's institution (private to its active members via RLS). */
export async function POST(request: Request) {
  return orgRoute(request, PlacementSchema, "postPlacement", async ({ ctx, service }, body) => {
    const { error } = await service.from("opportunities").insert({
      institution_id: ctx.institutionId,
      created_by: ctx.userId,
      role: body.role,
      company: body.company,
      location: body.location ?? null,
      opportunity_type: body.opportunityType,
      skills: body.skills,
      eligibility: body.eligibility ?? null,
      deadline: body.deadline ?? null,
    });
    if (error) throw error;
    return {};
  });
}

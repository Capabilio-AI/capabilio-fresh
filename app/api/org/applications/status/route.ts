import { NextResponse } from "next/server";
import { orgRoute } from "@/lib/api/org-route";
import { ApplicationStatusSchema } from "@/lib/org/schemas";

/** TPO/admin move an applicant through the pipeline — only for drives of THEIR institution. */
export async function POST(request: Request) {
  return orgRoute(request, ApplicationStatusSchema, "postPlacement", async ({ ctx, service }, body) => {
    const { data: app } = await service.from("applications").select("id, opportunity_id").eq("id", body.applicationId).maybeSingle();
    const { data: opp } = app ? await service.from("opportunities").select("institution_id").eq("id", app.opportunity_id).maybeSingle() : { data: null };
    if (!app || !opp || opp.institution_id !== ctx.institutionId) return NextResponse.json({ error: "Application not found." }, { status: 404 });
    const { error } = await service.from("applications").update({ status: body.status }).eq("id", app.id);
    if (error) throw error;
    return {};
  });
}

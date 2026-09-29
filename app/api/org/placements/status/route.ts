import { NextResponse } from "next/server";
import { orgRoute } from "@/lib/api/org-route";
import { VisitStatusSchema } from "@/lib/org/schemas";
import { untyped } from "@/lib/org/db";

/** Move a company visit through planned → registration open → completed (or cancelled). Own college only. */
export async function POST(request: Request) {
  return orgRoute(request, VisitStatusSchema, "postPlacement", async ({ ctx, service }, body) => {
    const { data, error } = await untyped(service).from("opportunities").update({ drive_status: body.status }).eq("id", body.opportunityId).eq("institution_id", ctx.institutionId).select("id");
    if (error) throw error;
    if (!data || data.length === 0) return NextResponse.json({ error: "Company visit not found." }, { status: 404 });
    return {};
  });
}

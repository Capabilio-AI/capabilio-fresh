import { NextResponse } from "next/server";
import { orgRoute } from "@/lib/api/org-route";
import { ApplySchema } from "@/lib/org/schemas";
import { getStudentDirection } from "@/lib/career/direction";

/**
 * A student applies to a CAMPUS drive of their own institution. Applications are server-written only
 * (client writes to `applications` are revoked), so status can never be self-set.
 */
export async function POST(request: Request) {
  return orgRoute(request, ApplySchema, "applyToDrive", async ({ ctx, supabase, service }, body) => {
    const direction = await getStudentDirection(supabase, ctx.userId);
    if (!direction?.inDirectionWindow) return NextResponse.json({ error: "Launchpad opens in your final two years." }, { status: 403 });

    const { data: opp } = await service.from("opportunities").select("id, institution_id, deadline").eq("id", body.opportunityId).maybeSingle();
    if (!opp || opp.institution_id !== ctx.institutionId) return NextResponse.json({ error: "Drive not found." }, { status: 404 });
    if (opp.deadline && opp.deadline < new Date().toISOString().slice(0, 10)) return NextResponse.json({ error: "Applications for this drive have closed." }, { status: 409 });

    const { error } = await service.from("applications").upsert({ opportunity_id: opp.id, user_id: ctx.userId }, { onConflict: "opportunity_id,user_id", ignoreDuplicates: true });
    if (error) throw error;
    return {};
  });
}

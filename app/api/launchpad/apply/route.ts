import { NextResponse } from "next/server";
import { orgRoute } from "@/lib/api/org-route";
import { ApplySchema } from "@/lib/org/schemas";
import { getStudentDirection } from "@/lib/career/direction";
import { untyped } from "@/lib/org/db";

/**
 * A student registers for a company visit at their OWN college. Registrations are server-written only (client writes
 * to `applications` are revoked), so a status can never be self-set. Registration must be open and the student's
 * branch eligible.
 */
export async function POST(request: Request) {
  return orgRoute(request, ApplySchema, "applyToDrive", async ({ ctx, supabase, service }, body) => {
    const direction = await getStudentDirection(supabase, ctx.userId);
    if (!direction?.launchpadOpen) return NextResponse.json({ error: "Company visits open for registration once you reach your final year." }, { status: 403 });

    const { data } = await untyped(service).from("opportunities").select("id, institution_id, deadline, drive_status, eligible_branches").eq("id", body.opportunityId).maybeSingle();
    const opp = data as { id: string; institution_id: string | null; deadline: string | null; drive_status: string; eligible_branches: string[] | null } | null;
    if (!opp || opp.institution_id !== ctx.institutionId) return NextResponse.json({ error: "Company visit not found." }, { status: 404 });
    if (opp.drive_status !== "registration_open") return NextResponse.json({ error: "Registration for this visit isn't open." }, { status: 409 });
    if (opp.deadline && opp.deadline < new Date().toISOString().slice(0, 10)) return NextResponse.json({ error: "Registration for this visit has closed." }, { status: 409 });
    const branches = opp.eligible_branches ?? [];
    if (branches.length > 0 && !branches.some((b) => b.trim().toLowerCase() === (ctx.branch ?? "").trim().toLowerCase())) {
      return NextResponse.json({ error: "This visit isn't open to your branch." }, { status: 403 });
    }

    const { error } = await service.from("applications").upsert({ opportunity_id: opp.id, user_id: ctx.userId }, { onConflict: "opportunity_id,user_id", ignoreDuplicates: true });
    if (error) throw error;
    return {};
  });
}

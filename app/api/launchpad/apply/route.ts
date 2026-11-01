import { branchMatchesAny } from "@/lib/org/branch-scope";
import { NextResponse } from "next/server";
import { orgRoute } from "@/lib/api/org-route";
import { ApplySchema } from "@/lib/org/schemas";
import { getStudentDirection } from "@/lib/career/direction";
import { untyped } from "@/lib/org/db";
import { notify } from "@/lib/notifications/notify";
import { hasRollNumber, ROLL_NUMBER_REQUIRED_MESSAGE } from "@/lib/org/visits";
import { staffWithPermission } from "@/lib/notifications/audiences";

/**
 * A student registers for a company visit at their OWN college. Registrations are server-written only (client writes
 * to `applications` are revoked), so a status can never be self-set. Registration must be open and the student's
 * branch eligible.
 */
export async function POST(request: Request) {
  return orgRoute(request, ApplySchema, "applyToDrive", async ({ ctx, supabase, service }, body) => {
    const direction = await getStudentDirection(supabase, ctx.userId);
    if (!direction?.launchpadOpen) return NextResponse.json({ error: "Company visits open for registration once you reach your final year." }, { status: 403 });

    const { data } = await untyped(service).from("opportunities").select("id, institution_id, deadline, drive_status, eligible_branches, company").eq("id", body.opportunityId).maybeSingle();
    const opp = data as { id: string; institution_id: string | null; deadline: string | null; drive_status: string; eligible_branches: string[] | null; company: string } | null;
    if (!opp || opp.institution_id !== ctx.institutionId) return NextResponse.json({ error: "Company visit not found." }, { status: 404 });
    if (opp.drive_status !== "registration_open") return NextResponse.json({ error: "Registration for this visit isn't open." }, { status: 409 });
    if (opp.deadline && opp.deadline < new Date().toISOString().slice(0, 10)) return NextResponse.json({ error: "Registration for this visit has closed." }, { status: 409 });
    const branches = opp.eligible_branches ?? [];
    if (branches.length > 0 && !branchMatchesAny(branches, ctx.branch)) {
      return NextResponse.json({ error: "This visit isn't open to your branch." }, { status: 403 });
    }

    const { data: mine } = await service.from("institution_memberships").select("roll_number").eq("id", ctx.membershipId).maybeSingle();
    if (!hasRollNumber(mine?.roll_number)) return NextResponse.json({ error: ROLL_NUMBER_REQUIRED_MESSAGE }, { status: 409 });

    const { error } = await service.from("applications").upsert({ opportunity_id: opp.id, user_id: ctx.userId }, { onConflict: "opportunity_id,user_id", ignoreDuplicates: true });
    if (error) throw error;
    // keyed by the registration itself: a student who withdrew and registered again is a new registration the college should hear about
    const { data: registration } = await service.from("applications").select("id").eq("opportunity_id", opp.id).eq("user_id", ctx.userId).maybeSingle();
    const { data: me } = await service.from("profiles").select("full_name").eq("id", ctx.userId).maybeSingle();
    await notify(service, {
      userIds: await staffWithPermission(service, ctx.institutionId, "placements"),
      type: "drive_registration",
      title: `${me?.full_name ?? "A student"} registered for ${opp.company}`,
      href: `/org/placements/${opp.id}`,
      actorId: ctx.userId,
      institutionId: ctx.institutionId,
      dedupeKey: `apply:${registration?.id ?? `${opp.id}:${ctx.userId}`}`,
    });
    return {};
  });
}

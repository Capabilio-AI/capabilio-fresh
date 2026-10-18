import { NextResponse } from "next/server";
import { orgRoute } from "@/lib/api/org-route";
import { MemberDecisionSchema } from "@/lib/org/schemas";
import { IN_APP_APPROVABLE_ROLES } from "@/lib/org/roles";
import { notify } from "@/lib/notifications/notify";

/** Org admins approve/revoke pending faculty, HOD and TPO of THEIR institution. Admin roles stay operator-approved (no self-promotion by claiming an institution's name). */
export async function POST(request: Request) {
  return orgRoute(request, MemberDecisionSchema, "approveMembers", async ({ ctx, service }, body) => {
    const { data: target } = await service
      .from("institution_memberships")
      .select("id, user_id, role, status, institution_id")
      .eq("id", body.membershipId)
      .eq("institution_id", ctx.institutionId)
      .maybeSingle();
    if (!target || target.status !== "pending") return NextResponse.json({ error: "Membership not found." }, { status: 404 });
    if (!(IN_APP_APPROVABLE_ROLES as readonly string[]).includes(target.role)) {
      return NextResponse.json({ error: "This role can only be approved by the Capabilio team." }, { status: 403 });
    }
    const { error } = await service
      .from("institution_memberships")
      .update({ status: body.decision === "approve" ? "active" : "revoked" })
      .eq("id", target.id);
    if (error) throw error;
    const approved = body.decision === "approve";
    await notify(service, {
      userIds: [target.user_id],
      type: approved ? "membership_approved" : "membership_rejected",
      title: approved ? `You now have access to ${ctx.institutionName}` : `Your request to join ${ctx.institutionName} wasn't approved`,
      body: approved ? "Open the workspace to get started." : "Contact the college if you think this is a mistake.",
      href: approved ? "/org" : undefined,
      actorId: ctx.userId,
      institutionId: ctx.institutionId,
      dedupeKey: `membership:${target.id}:${body.decision}`,
    });
    return {};
  });
}

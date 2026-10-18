import { NextResponse } from "next/server";
import { orgRoute } from "@/lib/api/org-route";
import { MemberRoleSchema } from "@/lib/org/schemas";
import { checkGrant } from "@/lib/org/team";
import { kindOf } from "@/lib/org/roles";
import { untyped } from "@/lib/org/db";

/** Change a team member's role (and access with it). Never your own, never the principal, and never above what you hold. */
export async function POST(request: Request) {
  return orgRoute(request, MemberRoleSchema, "approveMembers", async ({ ctx, service }, body) => {
    const db = untyped(service);
    const { data } = await db.from("institution_memberships").select("id, user_id, role, status").eq("id", body.membershipId).eq("institution_id", ctx.institutionId).maybeSingle();
    const target = data as { id: string; user_id: string; role: string; status: string } | null;
    if (!target || target.status !== "active" || kindOf(target.role) === "student") return NextResponse.json({ error: "Member not found." }, { status: 404 });
    if (target.user_id === ctx.userId) return NextResponse.json({ error: "You can't change your own role." }, { status: 403 });
    if (target.role === "principal") return NextResponse.json({ error: "The principal account can only be changed by the Capabilio team." }, { status: 403 });
    if (kindOf(target.role) === "admin" && ctx.kind !== "admin") return NextResponse.json({ error: "Only an admin can change an admin." }, { status: 403 });
    const grant = checkGrant(ctx, body.role, body.permissions);
    if (!grant.ok) return NextResponse.json({ error: grant.message }, { status: 403 });

    const { error } = await db.from("institution_memberships").update({ role: body.role, permissions: kindOf(body.role) === "admin" ? null : body.permissions }).eq("id", target.id);
    if (error) throw error;
    // the profile's primary role follows, exactly as it is set when an invitation is accepted
    await service.from("profiles").update({ primary_role: body.role as never }).eq("id", target.user_id);
    return {};
  });
}

import { NextResponse } from "next/server";
import { orgRoute } from "@/lib/api/org-route";
import { MemberPermissionsSchema } from "@/lib/org/schemas";
import { checkGrant } from "@/lib/org/team";
import { kindOf } from "@/lib/org/roles";
import { untyped } from "@/lib/org/db";

/** Change what a team member may do. Admin roles always have everything, and you can't edit your own access. */
export async function POST(request: Request) {
  return orgRoute(request, MemberPermissionsSchema, "approveMembers", async ({ ctx, service }, body) => {
    const db = untyped(service);
    const { data } = await db.from("institution_memberships").select("id, user_id, role, status").eq("id", body.membershipId).eq("institution_id", ctx.institutionId).maybeSingle();
    const target = data as { id: string; user_id: string; role: string; status: string } | null;
    if (!target || target.status !== "active" || kindOf(target.role) === "student") return NextResponse.json({ error: "Member not found." }, { status: 404 });
    if (target.user_id === ctx.userId) return NextResponse.json({ error: "You can't change your own access." }, { status: 403 });
    if (kindOf(target.role) === "admin") return NextResponse.json({ error: "Admins always have full access." }, { status: 403 });
    const grant = checkGrant(ctx, target.role, body.permissions);
    if (!grant.ok) return NextResponse.json({ error: grant.message }, { status: 403 });
    const { error } = await db.from("institution_memberships").update({ permissions: body.permissions }).eq("id", target.id);
    if (error) throw error;
    return {};
  });
}

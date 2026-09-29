import { NextResponse } from "next/server";
import { orgRoute } from "@/lib/api/org-route";
import { MemberIdSchema } from "@/lib/org/schemas";
import { kindOf } from "@/lib/org/roles";
import { untyped } from "@/lib/org/db";

/** Remove a team member's access (their account stays; they simply can't enter the workspace). */
export async function POST(request: Request) {
  return orgRoute(request, MemberIdSchema, "approveMembers", async ({ ctx, service }, body) => {
    const db = untyped(service);
    const { data } = await db.from("institution_memberships").select("id, user_id, role, status").eq("id", body.membershipId).eq("institution_id", ctx.institutionId).maybeSingle();
    const target = data as { id: string; user_id: string; role: string; status: string } | null;
    if (!target || target.status === "revoked" || kindOf(target.role) === "student") return NextResponse.json({ error: "Member not found." }, { status: 404 });
    if (target.user_id === ctx.userId) return NextResponse.json({ error: "You can't remove your own access." }, { status: 403 });
    if (target.role === "principal") return NextResponse.json({ error: "The principal account can only be changed by the Capabilio team." }, { status: 403 });
    if (kindOf(target.role) === "admin" && ctx.kind !== "admin") return NextResponse.json({ error: "Only an admin can remove an admin." }, { status: 403 });
    const { error } = await db.from("institution_memberships").update({ status: "revoked" }).eq("id", target.id);
    if (error) throw error;
    return {};
  });
}

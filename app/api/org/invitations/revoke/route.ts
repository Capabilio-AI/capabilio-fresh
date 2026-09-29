import { NextResponse } from "next/server";
import { orgRoute } from "@/lib/api/org-route";
import { InviteIdSchema } from "@/lib/org/schemas";
import { untyped } from "@/lib/org/db";

export async function POST(request: Request) {
  return orgRoute(request, InviteIdSchema, "approveMembers", async ({ ctx, service }, body) => {
    const { data, error } = await untyped(service)
      .from("org_invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", body.invitationId)
      .eq("institution_id", ctx.institutionId)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .select("id");
    if (error) throw error;
    if (!data || data.length === 0) return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
    return {};
  });
}

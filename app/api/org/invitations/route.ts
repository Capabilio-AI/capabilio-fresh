import { NextResponse } from "next/server";
import { orgRoute } from "@/lib/api/org-route";
import { InviteSchema } from "@/lib/org/schemas";
import { INVITE_TTL_DAYS, checkGrant, inviteUrl, newInviteToken } from "@/lib/org/team";
import { untyped } from "@/lib/org/db";

/**
 * Invite a staff member by email. The role and permissions are chosen here by an authorised member (never by the
 * invitee); an invite can never grant more than the inviter holds. Sending the same email again replaces the old link.
 */
export async function POST(request: Request) {
  return orgRoute(request, InviteSchema, "approveMembers", async ({ ctx, service }, body) => {
    const grant = checkGrant(ctx, body.role, body.permissions);
    if (!grant.ok) return NextResponse.json({ error: grant.message }, { status: 403 });

    const { data: existing } = await service.from("profiles").select("id").ilike("email", body.email).maybeSingle();
    if (existing) {
      return NextResponse.json({ error: "That email already has a Capabilio account. Invite a different work email address." }, { status: 409 });
    }

    const db = untyped(service);
    await db
      .from("org_invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("institution_id", ctx.institutionId)
      .eq("email", body.email)
      .is("accepted_at", null)
      .is("revoked_at", null);

    const { token, hash } = newInviteToken();
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000).toISOString();
    const { error } = await db.from("org_invitations").insert({
      institution_id: ctx.institutionId,
      email: body.email,
      role: body.role,
      permissions: body.permissions ?? null,
      token_hash: hash,
      invited_by_membership_id: ctx.membershipId,
      expires_at: expiresAt,
    });
    if (error) throw error;
    return { inviteUrl: inviteUrl(new URL(request.url).origin, token), expiresAt, email: body.email };
  });
}

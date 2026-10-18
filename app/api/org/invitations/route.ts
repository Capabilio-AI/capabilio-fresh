import { NextResponse } from "next/server";
import { orgRoute } from "@/lib/api/org-route";
import { InviteSchema } from "@/lib/org/schemas";
import { INVITE_TTL_DAYS, checkGrant, inviteUrl, newInviteToken } from "@/lib/org/team";
import { untyped } from "@/lib/org/db";
import { INVITABLE_ROLES } from "@/lib/org/roles";
import { sendEmail } from "@/lib/email/send";
import { staffInviteEmail } from "@/lib/email/invite-email";

/**
 * Invite a staff member by email. The role and permissions are chosen here by an authorised member (never by the
 * invitee); an invite can never grant more than the inviter holds. Sending the same email again replaces the old link.
 */
export async function POST(request: Request) {
  return orgRoute(request, InviteSchema, "approveMembers", async ({ ctx, service }, body) => {
    const grant = checkGrant(ctx, body.role, body.permissions);
    if (!grant.ok) return NextResponse.json({ error: grant.message }, { status: 403 });

    const { data: existing } = await service.from("profiles").select("id").eq("email", body.email.toLowerCase()).maybeSingle();
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

    const url = inviteUrl(new URL(request.url).origin, token);
    const { data: inviter } = await service.from("profiles").select("full_name").eq("id", ctx.userId).maybeSingle();
    const mail = await sendEmail(
      staffInviteEmail({
        to: body.email,
        institutionName: ctx.institutionName,
        roleLabel: INVITABLE_ROLES.find((r) => r.role === body.role)?.label ?? body.role,
        inviterName: inviter?.full_name ?? null,
        url,
        expiresOn: new Date(expiresAt).toLocaleDateString("en-IN", { dateStyle: "long" }),
      })
    );
    // the link is always returned so the admin can still share it by hand if email isn't set up or didn't go through
    return { inviteUrl: url, expiresAt, email: body.email, emailSent: mail.sent, emailProblem: mail.sent ? null : mail.reason };
  });
}

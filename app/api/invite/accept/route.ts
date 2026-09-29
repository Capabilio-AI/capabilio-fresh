import { NextResponse } from "next/server";
import { AcceptInviteSchema } from "@/lib/org/schemas";
import { createServiceClient } from "@/lib/supabase/service";
import { hashToken } from "@/lib/org/team";
import { untyped } from "@/lib/org/db";

interface InvitationRow {
  id: string;
  institution_id: string;
  email: string;
  role: string;
  permissions: string[] | null;
}

/**
 * Public: someone opens their invite link and creates their account (name + password; the email is the one that was
 * invited). The role and permissions come from the stored invitation — nothing in this request can change them.
 * The invitation is claimed atomically first, so a link works exactly once.
 */
export async function POST(request: Request) {
  const parsed = AcceptInviteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  const { token, fullName, password } = parsed.data;

  const service = createServiceClient();
  const db = untyped(service);
  const nowIso = new Date().toISOString();

  const { data: claimed } = await db
    .from("org_invitations")
    .update({ accepted_at: nowIso })
    .eq("token_hash", hashToken(token))
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", nowIso)
    .select("id, institution_id, email, role, permissions");
  const invitation = (claimed as InvitationRow[] | null)?.[0];
  if (!invitation) return NextResponse.json({ error: "This invitation link is no longer valid. Ask your admin to send a new one." }, { status: 410 });

  const release = () => db.from("org_invitations").update({ accepted_at: null }).eq("id", invitation.id);

  const { data: created, error: createError } = await service.auth.admin.createUser({
    email: invitation.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (createError || !created.user) {
    await release();
    const taken = /already|registered|exists/i.test(createError?.message ?? "");
    return NextResponse.json({ error: taken ? "That email already has a Capabilio account." : (createError?.message ?? "Could not create your account.") }, { status: taken ? 409 : 400 });
  }
  const userId = created.user.id;

  const rollback = async () => {
    await service.auth.admin.deleteUser(userId);
    await release();
  };
  const { error: roleError } = await service.from("profiles").update({ primary_role: invitation.role as never }).eq("id", userId);
  if (roleError) {
    await rollback();
    return NextResponse.json({ error: "Could not set up your access. Please try again." }, { status: 500 });
  }
  const { data: membership, error: memberError } = await db
    .from("institution_memberships")
    .insert({ user_id: userId, institution_id: invitation.institution_id, role: invitation.role, permissions: invitation.permissions })
    .select("id")
    .single();
  if (memberError || !membership) {
    await rollback();
    return NextResponse.json({ error: "Could not set up your access. Please try again." }, { status: 500 });
  }
  // the insert trigger parks privileged roles as 'pending'; this admin-issued invitation is the approval
  const { error: activateError } = await db.from("institution_memberships").update({ status: "active" }).eq("id", membership.id);
  if (activateError) {
    await rollback();
    return NextResponse.json({ error: "Could not set up your access. Please try again." }, { status: 500 });
  }
  await db.from("org_invitations").update({ accepted_user_id: userId }).eq("id", invitation.id);
  return NextResponse.json({ ok: true, email: invitation.email });
}

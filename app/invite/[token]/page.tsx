import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/service";
import { hashToken, isInvitationUsable } from "@/lib/org/team";
import { effectivePermissions, ORG_PERMISSIONS, kindOf } from "@/lib/org/roles";
import { ROLE_LABEL } from "@/lib/org/nav";
import { initialsOf } from "@/lib/org/format";
import { untyped, type OrgProfileRow } from "@/lib/org/db";
import { OrgTheme } from "@/components/org/OrgTheme";
import { AcceptInviteForm } from "@/components/org/AcceptInviteForm";

export const metadata: Metadata = { title: "Join your college's team — Capabilio AI", robots: { index: false } };

interface InvitationInfo {
  email: string;
  role: string;
  permissions: string[] | null;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  institution_id: string;
}

/** Public invitation page. The token is the only thing needed; an invalid, used or expired link says so plainly. */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const service = createServiceClient();
  const db = untyped(service);
  const { data } = await db.from("org_invitations").select("email, role, permissions, expires_at, accepted_at, revoked_at, institution_id").eq("token_hash", hashToken(token)).maybeSingle();
  const inv = data as InvitationInfo | null;
  const valid = isInvitationUsable(inv);

  let institutionName = "";
  let logo: string | null = null;
  if (valid) {
    const [{ data: inst }, { data: profile }] = await Promise.all([
      service.from("institutions").select("name").eq("id", inv.institution_id).maybeSingle(),
      db.from("org_profiles").select("*").eq("institution_id", inv.institution_id).maybeSingle(),
    ]);
    institutionName = inst?.name ?? "your college";
    logo = (profile as OrgProfileRow | null)?.logo_url ?? null;
  }

  return (
    <OrgTheme>
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
        {valid && inv ? (
          <div className="o-card p-7">
            <div className="flex items-center gap-3">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element -- our own storage URL
                <img src={logo} alt="" className="h-12 w-12 rounded-xl object-cover" />
              ) : (
                <span className="o-logo-tile h-12 w-12 rounded-xl text-[16px]" aria-hidden="true">
                  {initialsOf(institutionName)}
                </span>
              )}
              <div>
                <p className="o-eyebrow">You&apos;re invited</p>
                <h1 className="o-serif text-[26px] leading-tight text-app-charcoal">{institutionName}</h1>
              </div>
            </div>
            <p className="mt-4 text-[13.5px] leading-relaxed text-app-muted">
              You&apos;ve been invited to join as <strong className="text-app-charcoal">{ROLE_LABEL[inv.role] ?? inv.role}</strong>. You&apos;ll be able to:
            </p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {kindOf(inv.role) === "admin" ? (
                <li className="rounded-full bg-app-success-container px-2.5 py-1 text-[11px] font-extrabold text-app-success">Everything in the workspace</li>
              ) : (
                [...effectivePermissions(inv.role, inv.permissions)].map((p) => (
                  <li key={p} className="rounded-full bg-white/[0.07] px-2.5 py-1 text-[11px] font-bold text-app-muted">
                    {ORG_PERMISSIONS.find((x) => x.key === p)?.label ?? p}
                  </li>
                ))
              )}
            </ul>
            <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-app-muted">
              <BadgeCheck size={13} className="text-app-success" aria-hidden="true" /> {institutionName} is approved by the Capabilio team.
            </p>
            <AcceptInviteForm token={token} email={inv.email} />
          </div>
        ) : (
          <div className="o-card p-7 text-center">
            <h1 className="o-serif text-[28px] text-app-charcoal">This invitation isn&apos;t valid</h1>
            <p className="mt-2 text-[13.5px] leading-relaxed text-app-muted">The link may have expired, been used already, or been cancelled. Ask your college admin to send you a new one.</p>
            <Link href="/login?path=organisation" className="o-btn mt-5">
              Go to sign in
            </Link>
          </div>
        )}
      </main>
    </OrgTheme>
  );
}
